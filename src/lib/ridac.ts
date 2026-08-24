export const RIDAC_TYPES = [
  "Risk",
  "Issue",
  "Decision",
  "Action",
  "Change Request",
  "Dependency",
] as const;
export type RidacType = (typeof RIDAC_TYPES)[number];

export const PHASES = ["Design", "Build", "Testing", "Maintenance"] as const;
export type Phase = (typeof PHASES)[number];

export const HEALTHS = ["Green", "Amber", "Red"] as const;
export type Health = (typeof HEALTHS)[number];

export const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
export const STATUSES = ["Open", "In Progress", "In Review", "Blocked", "Closed"] as const;

export type Project = {
  id: string;
  code: string;
  name: string;
  description: string;
  phase: string;
  health: string;
  priority: string;
  owner: string;
  start_date: string | null;
  target_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RidacItem = {
  id: string;
  project_id: string;
  ref_code: string;
  type: string;
  title: string;
  detail: string;
  owner: string;
  status: string;
  severity: string;
  due_date: string | null;
  resolution: string;
  created_at: string;
  updated_at: string;
};

export const TYPE_SHORT: Record<string, string> = {
  Risk: "RSK",
  Issue: "ISS",
  Decision: "DEC",
  Action: "ACT",
  "Change Request": "CR",
  Dependency: "DEP",
};

export const TYPE_TEXT: Record<string, string> = {
  Risk: "text-type-risk",
  Issue: "text-type-issue",
  Decision: "text-type-decision",
  Action: "text-type-action",
  "Change Request": "text-type-change",
  Dependency: "text-type-dependency",
};

export const HEALTH_DOT: Record<string, string> = {
  Green: "bg-status-green",
  Amber: "bg-status-amber",
  Red: "bg-status-red",
};

export const HEALTH_LABEL: Record<string, string> = {
  Green: "On Track",
  Amber: "At Risk",
  Red: "Off Track",
};

export const isOpen = (status: string) => status !== "Closed";

export function isOverdue(item: RidacItem) {
  if (!item.due_date || !isOpen(item.status)) return false;
  return new Date(item.due_date) < new Date(new Date().toDateString());
}

export function summariseCounts(items: RidacItem[]) {
  const open = items.filter((i) => isOpen(i.status));
  return {
    R: open.filter((i) => i.type === "Risk").length,
    I: open.filter((i) => i.type === "Issue").length,
    D: open.filter((i) => i.type === "Decision").length,
    A: open.filter((i) => i.type === "Action").length,
    C: open.filter((i) => i.type === "Change Request").length,
    Dep: open.filter((i) => i.type === "Dependency").length,
  };
}

/* ---------- CSV ---------- */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function toCsv(headers: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Best-effort mapping of a free-form CSV label onto a known option. */
export function matchOption<T extends string>(
  value: string,
  options: readonly T[],
  fallback: T,
): T {
  const v = value.trim().toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === v);
  if (exact) return exact;
  const partial = options.find((o) => v.startsWith(o.toLowerCase().slice(0, 3)) && v.length > 1);
  return partial ?? fallback;
}
