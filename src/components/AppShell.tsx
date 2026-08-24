import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, useRealtimePortfolio } from "@/lib/portfolio";
import { HEALTH_DOT } from "@/lib/ridac";
import { cn } from "@/lib/utils";

export function AppShell({
  title,
  meta,
  actions,
  children,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  useRealtimePortfolio();

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-64 flex-none flex-col bg-nav text-nav-foreground">
        <div className="border-b border-nav-foreground/10 p-6">
          <h1 className="text-xl font-bold tracking-tight">
            STRATOS<span className="text-accent">.PMO</span>
          </h1>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-nav-muted">
            Portfolio
          </div>
          <Link
            to="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-nav-foreground/80 transition-colors hover:bg-nav-foreground/5"
            activeOptions={{ exact: true }}
            activeProps={{ className: "bg-nav-foreground/10 text-nav-foreground" }}
          >
            Overview
          </Link>
          <Link
            to="/ridac"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-nav-foreground/80 transition-colors hover:bg-nav-foreground/5"
            activeProps={{ className: "bg-nav-foreground/10 text-nav-foreground" }}
          >
            RIDAC Central
          </Link>
          <div className="px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-nav-muted">
            Active Projects
          </div>
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-nav-foreground/70 transition-colors hover:bg-nav-foreground/5"
              activeProps={{ className: "bg-nav-foreground/10 text-nav-foreground" }}
            >
              <span className={cn("size-2 flex-none rounded-full", HEALTH_DOT[p.health])} />
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t border-nav-foreground/10 p-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="grid size-8 flex-none place-items-center rounded-full bg-nav-foreground/10 text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{user?.email}</p>
              <button
                className="text-xs text-nav-muted hover:text-accent"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/auth" });
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-8">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            {meta}
          </div>
          <div className="flex items-center gap-3">{actions}</div>
        </header>
        <div className="mx-auto max-w-7xl space-y-8 p-8">{children}</div>
      </main>
    </div>
  );
}

export function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
      {children}
    </span>
  );
}
