import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useIsMember, useMembership } from "@/lib/portfolio";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Members — Stratos PMO" },
      { name: "description", content: "Invite and manage who has access to this workspace." },
    ],
  }),
  component: AdminPage,
});

// Postgrest errors carry the real fix in `hint`/`code`, not `message` --
// logging the full object (not just .message) is what the docs recommend.
// Duck-typed rather than `instanceof Error` so it also handles plain
// { message, hint, code } objects that never go through an Error subclass.
function errorMessage(err: unknown, fallback: string): string {
  console.error(err);
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return fallback;
}

type Member = {
  id: string;
  user_id: string | null;
  email: string;
  role: string;
  invited_by: string;
  created_at: string;
  claimed_at: string | null;
};

function AdminPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const { data: isMember } = useIsMember();
  const { data: membership } = useMembership();

  if (!session) return null;
  if (isMember === false) return <NoAccess />;
  if (membership && membership.role !== "owner") {
    return (
      <AppShell title="Members">
        <p className="text-sm text-muted-foreground">Only owners can manage workspace members.</p>
      </AppShell>
    );
  }

  return <MembersPanel />;
}

function MembersPanel() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "owner">("member");

  const members = useQuery({
    queryKey: ["app-members"],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("app_members")
        .select("id, user_id, email, role, invited_by, created_at, claimed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invite = useMutation({
    mutationFn: async (input: { email: string; role: "member" | "owner" }) => {
      const normalized = input.email.trim().toLowerCase();
      const { error } = await supabase.from("app_members").insert({
        email: normalized,
        role: input.role,
        invited_by: user?.email ?? "",
      });
      if (error) throw error;
      return normalized;
    },
    onSuccess: (invitedEmail) => {
      setEmail("");
      toast.success(`${invitedEmail} can now sign up at /auth to get access`);
      qc.invalidateQueries({ queryKey: ["app-members"] });
    },
    onError: (err) => {
      const message = errorMessage(err, "Could not send invite");
      toast.error(
        message.includes("duplicate") || message.includes("app_members_email_lower_idx")
          ? "That email is already invited or a member."
          : message,
      );
    },
  });

  const revoke = useMutation({
    mutationFn: async (target: Member) => {
      // Exact id comparison, not email string matching: the database now
      // refuses this at the RLS/trigger level too (migration 20261015030000),
      // so this is purely a faster, friendlier message, not the real guard.
      if (target.user_id && target.user_id === user?.id) {
        throw new Error("You can't remove your own access.");
      }
      if (target.role === "owner") {
        const owners = (members.data ?? []).filter((m) => m.role === "owner");
        if (owners.length <= 1) throw new Error("Can't remove the last owner.");
      }
      const { error } = await supabase.from("app_members").delete().eq("id", target.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Access revoked");
      qc.invalidateQueries({ queryKey: ["app-members"] });
    },
    onError: (err) => toast.error(errorMessage(err, "Could not revoke access")),
  });

  return (
    <AppShell title="Members">
      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <section className="h-fit space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">Invite someone</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate({ email, role });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Work email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as "member" | "owner")}
              >
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={invite.isPending}>
              Send invite
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            This authorizes the email, but doesn't create a login. Tell them to sign up at{" "}
            <span className="font-mono">/auth</span> with this exact email — they pick their own
            password, and access is granted the moment their account exists.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Members</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Invited by</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(members.data ?? []).map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">{m.email}</td>
                    <td className="px-4 py-3 capitalize">{m.role}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {m.claimed_at ? "Active" : "Pending sign-up"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {m.invited_by || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revoke.mutate(m)}
                        disabled={revoke.isPending}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
                {members.data?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No members yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
