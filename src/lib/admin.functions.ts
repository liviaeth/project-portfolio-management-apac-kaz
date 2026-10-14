import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Admin-only member management. Every handler here uses the service-role
// client, which bypasses Row Level Security entirely, so each one re-checks
// the caller is an owner itself -- do not rely on route-level UI gating.
//
// supabaseAdmin is imported dynamically inside each handler, never at module
// top level: this file is a *.functions.ts module, which (unlike *.server.ts)
// ships a client-side stub to the browser bundle. See the comment on
// src/integrations/supabase/client.server.ts.

async function requireOwner(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_members")
    .select("email, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not verify permissions.");
  if (!data || data.role !== "owner") {
    throw new Error("Forbidden: owner access required.");
  }
  return { supabaseAdmin, callerEmail: data.email };
}

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await requireOwner(context.userId);
    const { data, error } = await supabaseAdmin
      .from("app_members")
      .select("id, email, role, invited_by, created_at, claimed_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const InviteInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["member", "owner"]),
});

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, callerEmail } = await requireOwner(context.userId);
    const { email, role } = data;

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("app_members")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (existing) throw new Error(`${email} is already invited or a member.`);

    // Insert the membership row BEFORE creating the auth account: the
    // handle_new_user trigger only claims a pending invite for brand-new
    // signups, so the row has to exist first.
    const { error: insertErr } = await supabaseAdmin
      .from("app_members")
      .insert({ email, role, invited_by: callerEmail ?? "" });
    if (insertErr) throw new Error(insertErr.message);

    const { randomBytes } = await import("node:crypto");
    const tempPassword = randomBytes(12).toString("base64url");

    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { invited_by: callerEmail ?? "" },
    });

    if (!createErr) {
      return { email, role, tempPassword };
    }

    const alreadyRegistered =
      createErr.code === "email_exists" || /already.*registere?d/i.test(createErr.message);
    if (!alreadyRegistered) {
      // Roll back the membership row so a failed invite doesn't leave a
      // dangling, unclaimable entry blocking a future retry.
      await supabaseAdmin.from("app_members").delete().eq("email", email);
      throw new Error(createErr.message);
    }

    // They already had an auth account from before this table existed (or
    // from the open-signup period) -- the trigger never ran for them, so
    // link it directly instead of leaving the invite unclaimed.
    const { data: usersPage, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listErr) throw new Error(listErr.message);
    const existingUser = usersPage.users.find((u) => u.email?.toLowerCase() === email);
    if (existingUser) {
      await supabaseAdmin
        .from("app_members")
        .update({ user_id: existingUser.id, claimed_at: new Date().toISOString() })
        .eq("email", email);
    }

    return { email, role, tempPassword: undefined };
  });

const RemoveInput = z.object({ id: z.string().uuid() });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RemoveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requireOwner(context.userId);

    const { data: target, error: fetchErr } = await supabaseAdmin
      .from("app_members")
      .select("user_id, role")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!target) throw new Error("Member not found.");

    if (target.user_id === context.userId) {
      throw new Error("You can't remove your own access.");
    }

    if (target.role === "owner") {
      const { count, error: countErr } = await supabaseAdmin
        .from("app_members")
        .select("id", { count: "exact", head: true })
        .eq("role", "owner");
      if (countErr) throw new Error(countErr.message);
      if ((count ?? 0) <= 1) throw new Error("Can't remove the last owner.");
    }

    const { error } = await supabaseAdmin.from("app_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
