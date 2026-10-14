import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Stratos PMO" },
      { name: "description", content: "Sign in to your portfolio and RIDAC workspace." },
      { property: "og:title", content: "Sign in — Stratos PMO" },
      {
        property: "og:description",
        content: "Sign in to your portfolio and RIDAC workspace.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  // Self-service sign-up is deliberately absent: the workspace is invite-only.
  // Accounts are created by an administrator, and access additionally requires
  // a row in public.app_members, which row-level security checks on every table.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-nav px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-xl font-bold tracking-tight text-nav-foreground">
          STRATOS<span className="text-accent">.PMO</span>
        </h1>
        <p className="mt-2 text-center text-sm text-nav-muted">
          Portfolio health and RIDAC tracking for your delivery team.
        </p>

        <form
          onSubmit={submit}
          className="mt-8 space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Sign in
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            This workspace is invite-only. Ask an administrator to set up your account.
          </p>
        </form>
      </div>
    </div>
  );
}
