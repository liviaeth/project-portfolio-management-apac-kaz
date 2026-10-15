import { useNavigate } from "@tanstack/react-router";
import { forceSignOut, useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

/**
 * Shown when someone is signed in but has not been invited into the
 * workspace. Row-level security already returns nothing for them; this
 * replaces the resulting empty dashboard with an explanation.
 */
export function NoAccess() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="grid min-h-screen place-items-center bg-nav px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold tracking-tight text-nav-foreground">
          STRATOS<span className="text-accent">.PMO</span>
        </h1>
        <div className="mt-8 space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">This workspace is invite-only</h2>
          <p className="text-sm text-muted-foreground">
            {user?.email ? (
              <>
                <span className="font-medium text-foreground">{user.email}</span> is not on the
                member list.
              </>
            ) : (
              <>Your account is not on the member list.</>
            )}{" "}
            Ask a workspace administrator to invite you, then sign in again.
          </p>
          {user?.id && (
            <p className="break-all font-mono text-[10px] text-muted-foreground/60">
              user id: {user.id}
            </p>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await forceSignOut();
              navigate({ to: "/auth" });
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
