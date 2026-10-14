import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useIsMember, useMembership } from "@/lib/portfolio";
import { inviteMember, listMembers, removeMember } from "@/lib/admin.functions";

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
  const invokeInvite = useServerFn(inviteMember);
  const invokeRemove = useServerFn(removeMember);
  const invokeList = useServerFn(listMembers);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "owner">("member");
  const [lastInvite, setLastInvite] = useState<{
    email: string;
    tempPassword: string | undefined;
  } | null>(null);

  const members = useQuery({
    queryKey: ["app-members"],
    queryFn: () => invokeList(),
  });

  const invite = useMutation({
    mutationFn: (input: { email: string; role: "member" | "owner" }) =>
      invokeInvite({ data: input }),
    onSuccess: (result) => {
      setLastInvite({ email: result.email, tempPassword: result.tempPassword });
      setEmail("");
      toast.success(
        result.tempPassword
          ? `Account created for ${result.email}`
          : `${result.email} already had an account — access granted`,
      );
      qc.invalidateQueries({ queryKey: ["app-members"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send invite"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => invokeRemove({ data: { id } }),
    onSuccess: () => {
      toast.success("Access revoked");
      qc.invalidateQueries({ queryKey: ["app-members"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not revoke access"),
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

          {lastInvite && (
            <div className="rounded-md border border-accent/30 bg-accent/10 p-3 text-xs">
              {lastInvite.tempPassword ? (
                <>
                  <p className="font-medium text-foreground">
                    Share this with {lastInvite.email} — shown once, not stored anywhere:
                  </p>
                  <p className="mt-1 break-all font-mono text-sm">{lastInvite.tempPassword}</p>
                </>
              ) : (
                <p>
                  {lastInvite.email} already had an account. Access was granted; no new password.
                </p>
              )}
            </div>
          )}
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
                      {m.claimed_at ? "Active" : "Pending sign-in"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {m.invited_by || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revoke.mutate(m.id)}
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
