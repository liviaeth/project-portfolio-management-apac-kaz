import { useMemo } from "react";
import { MILESTONE_BAR, type Milestone } from "@/lib/ridac";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;

function toDate(v: string | null) {
  return v ? new Date(`${v}T00:00:00`) : null;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function GanttChart({
  milestones,
  onOpen,
}: {
  milestones: Milestone[];
  onOpen: (m: Milestone) => void;
}) {
  const rows = milestones.filter((m) => m.start_date && m.end_date);

  const scale = useMemo(() => {
    if (rows.length === 0) return null;
    const starts = rows.map((m) => toDate(m.start_date)!.getTime());
    const ends = rows.map((m) => toDate(m.end_date)!.getTime());
    let min = Math.min(...starts);
    let max = Math.max(...ends);
    const pad = Math.max((max - min) * 0.05, 3 * DAY);
    min -= pad;
    max += pad;

    const months: { label: string; left: number }[] = [];
    const cursor = new Date(min);
    cursor.setDate(1);
    while (cursor.getTime() <= max) {
      const t = cursor.getTime();
      if (t >= min) months.push({ label: monthLabel(cursor), left: ((t - min) / (max - min)) * 100 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { min, max, span: max - min, months };
  }, [rows]);

  if (!scale) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No milestones with dates yet. Add one to build the Gantt chart.
      </div>
    );
  }

  const pct = (t: number) => ((t - scale.min) / scale.span) * 100;
  const todayPct = pct(Date.now());

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-[220px_1fr] border-b border-border bg-secondary text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <div className="px-4 py-3">Milestone</div>
        <div className="relative h-9">
          {scale.months.map((m) => (
            <span
              key={m.label + m.left}
              className="absolute top-2.5 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${m.left}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border">
        {rows.map((m) => {
          const s = pct(toDate(m.start_date)!.getTime());
          const e = pct(toDate(m.end_date)!.getTime() + DAY);
          return (
            <button
              key={m.id}
              onClick={() => onOpen(m)}
              className="grid w-full grid-cols-[220px_1fr] items-center text-left transition-colors hover:bg-secondary/60"
            >
              <div className="px-4 py-3">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {m.owner || "Unassigned"} · {m.status}
                </p>
              </div>
              <div className="relative h-12 pr-4">
                {todayPct >= 0 && todayPct <= 100 && (
                  <span
                    className="absolute inset-y-0 w-px bg-status-red/60"
                    style={{ left: `${todayPct}%` }}
                  />
                )}
                <div
                  className={cn(
                    "absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-full",
                    MILESTONE_BAR[m.status] ?? "bg-primary",
                  )}
                  style={{ left: `${s}%`, width: `${Math.max(e - s, 1.2)}%` }}
                  title={`${m.start_date} → ${m.end_date} (${m.progress}%)`}
                >
                  <div
                    className="h-full bg-foreground/25"
                    style={{ width: `${Math.max(0, Math.min(100, m.progress))}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MilestoneList({
  milestones,
  onOpen,
}: {
  milestones: Milestone[];
  onOpen: (m: Milestone) => void;
}) {
  if (milestones.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Milestone</th>
            <th className="px-4 py-3">Phase</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Progress</th>
            <th className="px-4 py-3">Start</th>
            <th className="px-4 py-3">End</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {milestones.map((m) => (
            <tr
              key={m.id}
              onClick={() => onOpen(m)}
              className="cursor-pointer transition-colors hover:bg-secondary/60"
            >
              <td className="px-4 py-3 font-medium">{m.name}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{m.phase}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{m.owner || "—"}</td>
              <td className="px-4 py-3 text-xs">{m.status}</td>
              <td className="px-4 py-3 font-mono text-xs">{m.progress}%</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {m.start_date ?? "—"}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {m.end_date ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
