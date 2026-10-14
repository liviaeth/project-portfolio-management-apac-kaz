import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { NoAccess } from "@/components/NoAccess";
import { AssistantPanel } from "@/components/AssistantPanel";
import { ProjectDialog } from "@/components/ProjectDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useIsMember, useProjects, useRidacItems } from "@/lib/portfolio";
import {
  HEALTH_DOT,
  HEALTH_LABEL,
  PRIORITIES,
  isOpen,
  isOverdue,
  summariseCounts,
  type Project,
} from "@/lib/ridac";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Portfolio Overview — Stratos PMO" },
      {
        name: "description",
        content:
          "Live portfolio health, priority and RIDAC exposure across every delivery project.",
      },
      { property: "og:title", content: "Portfolio Overview — Stratos PMO" },
      {
        property: "og:description",
        content: "Live portfolio health, priority and RIDAC exposure across every project.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const { data: projects = [] } = useProjects();
  const { data: items = [] } = useRidacItems();
  const { data: isMember } = useIsMember();
  const [dialog, setDialog] = useState<{ open: boolean; project: Project | null }>({
    open: false,
    project: null,
  });
  const [sortBy, setSortBy] = useState<{ col: "priority" | "target"; dir: "asc" | "desc" } | null>(
    null,
  );

  function toggleSort(col: "priority" | "target") {
    setSortBy((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      return { col, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  const sortedProjects = useMemo(() => {
    if (!sortBy) return projects;
    const arr = [...projects];
    if (sortBy.col === "priority") {
      const rank = (p: string) => {
        const idx = PRIORITIES.indexOf(p as (typeof PRIORITIES)[number]);
        return idx === -1 ? PRIORITIES.length : idx;
      };
      arr.sort((a, b) => {
        const diff = rank(a.priority) - rank(b.priority);
        return sortBy.dir === "asc" ? diff : -diff;
      });
    } else {
      const time = (d: string | null) => (d ? new Date(d).getTime() : null);
      arr.sort((a, b) => {
        const ta = time(a.target_date);
        const tb = time(b.target_date);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        const diff = ta - tb;
        return sortBy.dir === "asc" ? diff : -diff;
      });
    }
    return arr;
  }, [projects, sortBy]);

  const stats = useMemo(() => {
    const open = items.filter((i) => isOpen(i.status));
    return {
      projects: projects.length,
      atRisk: projects.filter((p) => p.health !== "Green").length,
      openItems: open.length,
      overdue: items.filter(isOverdue).length,
    };
  }, [projects, items]);

  if (!session) return null;
  if (isMember === false) return <NoAccess />;

  return (
    <AppShell
      title="Portfolio Overview"
      actions={
        <Button size="sm" onClick={() => setDialog({ open: true, project: null })}>
          New project
        </Button>
      }
    >
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Projects tracked" value={stats.projects} />
        <Kpi label="Off-track (Amber/Red)" value={stats.atRisk} tone="amber" />
        <Kpi label="Open RIDAC items" value={stats.openItems} />
        <Kpi label="Overdue" value={stats.overdue} tone="red" />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Project health matrix
          </h3>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Phase</th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 hover:text-foreground"
                    onClick={() => toggleSort("priority")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Priority
                      <SortIcon active={sortBy?.col === "priority"} dir={sortBy?.dir} />
                    </span>
                  </th>
                  <th className="px-4 py-3">Health</th>
                  <th className="px-4 py-3">Open / Overdue</th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 hover:text-foreground"
                    onClick={() => toggleSort("target")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Target
                      <SortIcon active={sortBy?.col === "target"} dir={sortBy?.dir} />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedProjects.map((p) => {
                  const own = items.filter((i) => i.project_id === p.id);
                  const c = summariseCounts(own);
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-secondary/60">
                      <td className="px-4 py-3">
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: p.id }}
                          className="font-semibold hover:text-accent"
                        >
                          {p.name}
                        </Link>
                        <p className="font-mono text-[11px] text-muted-foreground">{p.code}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">{p.phase}</td>
                      <td className="px-4 py-3 text-xs">{p.priority}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-xs font-medium">
                          <span className={cn("size-2 rounded-full", HEALTH_DOT[p.health])} />
                          {HEALTH_LABEL[p.health] ?? p.health}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {c.open}
                        <span className="text-muted-foreground"> / </span>
                        <span className={c.overdue ? "font-bold text-status-red" : ""}>
                          {c.overdue}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {p.target_date ?? "—"}
                      </td>
                    </tr>
                  );
                })}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No projects yet — add your first one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <AssistantPanel />
      </div>

      <ProjectDialog
        open={dialog.open}
        project={dialog.project}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </AppShell>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" | undefined }) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" />;
  return dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />;
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "amber" | "red";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-3xl font-bold",
          tone === "amber" && "text-status-amber",
          tone === "red" && "text-status-red",
        )}
      >
        {value}
      </p>
    </div>
  );
}
