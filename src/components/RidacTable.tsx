import { useMemo, useState } from "react";
import {
  RIDAC_TYPES,
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
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => onOpen(i)}
                  className="cursor-pointer transition-colors hover:bg-secondary/60"
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
                    colSpan={showProject ? 8 : 7}
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
