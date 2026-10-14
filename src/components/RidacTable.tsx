import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  RIDAC_TYPES,
  SEVERITIES,
  TYPE_SHORT,
  TYPE_TEXT,
  isOverdue,
  type Project,
  type RidacItem,
} from "@/lib/ridac";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function RidacTable({
  items,
  projects,
  showProject,
  onOpen,
}: {
  items: RidacItem[];
  projects: Project[];
  showProject?: boolean;
  onOpen: (item: RidacItem) => void;
}) {
  const [type, setType] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [sortBy, setSortBy] = useState<{ col: "severity" | "due"; dir: "asc" | "desc" } | null>(
    null,
  );

  function toggleSort(col: "severity" | "due") {
    setSortBy((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      return { col, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  const projectName = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const filtered = items.filter((i) => {
    if (type !== "All" && i.type !== type) return false;
    if (openOnly && i.status === "Closed") return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${i.ref_code} ${i.title} ${i.detail} ${i.owner} ${i.status}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const arr = [...filtered];
    if (sortBy.col === "severity") {
      const rank = (s: string) => {
        const idx = SEVERITIES.indexOf(s as (typeof SEVERITIES)[number]);
        return idx === -1 ? SEVERITIES.length : idx;
      };
      arr.sort((a, b) => {
        const diff = rank(a.severity) - rank(b.severity);
        return sortBy.dir === "asc" ? diff : -diff;
      });
    } else {
      const time = (d: string | null) => (d ? new Date(d).getTime() : null);
      arr.sort((a, b) => {
        const ta = time(a.due_date);
        const tb = time(b.due_date);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        const diff = ta - tb;
        return sortBy.dir === "asc" ? diff : -diff;
      });
    }
    return arr;
  }, [filtered, sortBy]);

  const counts = (t: string) => items.filter((i) => i.type === t).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter rows…"
          className="h-8 w-56"
        />
        <FilterChip active={type === "All"} onClick={() => setType("All")}>
          All ({items.length})
        </FilterChip>
        {RIDAC_TYPES.map((t) => (
          <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
            <span className={TYPE_TEXT[t]}>{TYPE_SHORT[t]}</span> {t} ({counts(t)})
          </FilterChip>
        ))}
        <FilterChip active={openOnly} onClick={() => setOpenOnly(!openOnly)}>
          Open only
        </FilterChip>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Ref</th>
                {showProject && <th className="px-4 py-3">Project</th>}
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th
                  className="cursor-pointer select-none px-4 py-3 hover:text-foreground"
                  onClick={() => toggleSort("severity")}
                >
                  <span className="inline-flex items-center gap-1">
                    Severity
                    <SortIcon active={sortBy?.col === "severity"} dir={sortBy?.dir} />
                  </span>
                </th>
                <th className="px-4 py-3">Resolution / mitigation</th>
                <th className="px-4 py-3">Submitted</th>
                <th
                  className="cursor-pointer select-none px-4 py-3 hover:text-foreground"
                  onClick={() => toggleSort("due")}
                >
                  <span className="inline-flex items-center gap-1">
                    Due
                    <SortIcon active={sortBy?.col === "due"} dir={sortBy?.dir} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => onOpen(i)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-secondary/60",
                    i.status === "Closed" && "bg-status-green/15 hover:bg-status-green/20",
                    i.status === "In Review" && "bg-status-green/10 hover:bg-status-green/15",
                    i.status === "Blocked" && "bg-status-red/10 hover:bg-status-red/15",
                  )}
                >
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded border border-current/20 px-1.5 py-0.5 font-mono text-[10px] font-bold",
                        TYPE_TEXT[i.type] ?? "text-muted-foreground",
                      )}
                    >
                      {TYPE_SHORT[i.type] ?? i.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {i.ref_code || "—"}
                  </td>
                  {showProject && (
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {projectName.get(i.project_id)}
                    </td>
                  )}
                  <td className="max-w-md truncate px-4 py-3 font-medium">{i.title}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{i.owner || "—"}</td>
                  <td className="px-4 py-3 text-xs">{i.status}</td>
                  <td
                    className={cn(
                      "px-4 py-3 text-xs font-semibold",
                      i.severity === "Critical" && "text-status-red",
                      i.severity === "High" && "text-status-amber",
                    )}
                  >
                    {i.severity}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-muted-foreground">
                    {i.resolution || "—"}
                  </td>
                  <td className="tabular px-4 py-3 font-mono text-xs text-muted-foreground">
                    {i.submission_date ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "tabular px-4 py-3 font-mono text-xs",
                      isOverdue(i) ? "font-bold text-status-red" : "text-muted-foreground",
                    )}
                  >
                    {i.due_date ?? "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={showProject ? 10 : 9}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No items match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

        </div>
      </div>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" | undefined }) {
  if (!active) return <ArrowUpDown className="size-3 opacity-40" />;
  return dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />;
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border border-border px-3 py-1 text-xs transition-colors",
        active ? "bg-secondary font-bold text-foreground" : "bg-card text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
