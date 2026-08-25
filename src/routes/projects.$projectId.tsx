import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, MetaChip } from "@/components/AppShell";
import { AssistantPanel } from "@/components/AssistantPanel";
import { GanttChart, MilestoneList } from "@/components/GanttChart";
import { ItemDialog } from "@/components/ItemDialog";
import { MilestoneDialog } from "@/components/MilestoneDialog";
import { ProjectDialog } from "@/components/ProjectDialog";
import { RidacTable } from "@/components/RidacTable";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  useBulkInsertItems,
  useMilestones,
  useProjects,
  useRidacItems,
} from "@/lib/portfolio";
import {
  HEALTH_DOT,
  LIKELIHOODS,
  RIDAC_TYPES,
  RISK_RESPONSES,
  SEVERITIES,
  STATUSES,
  downloadCsv,
  matchOption,
  parseCsv,
  summariseCounts,
  toCsv,
  type Milestone,
  type RidacItem,
} from "@/lib/ridac";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$projectId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Project RIDAC log — Stratos PMO" },
      {
        name: "description",
        content: "Track risks, issues, decisions, actions, changes and dependencies per project.",
      },
      { property: "og:title", content: "Project RIDAC log — Stratos PMO" },
      {
        property: "og:description",
        content: "Per-project RIDAC log with CSV import, export and an AI assistant.",
      },
    ],
  }),
  component: ProjectPage,
});

const CSV_HEADERS = [
  "Ref",
  "Type",
  "Title",
  "Detail",
  "Owner",
  "Status",
  "Severity",
  "Risk Response",
  "Likelihood",
  "Submission Date",
  "Due Date",
  "Resolution",
];


function ProjectPage() {
  const { projectId } = Route.useParams();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const { data: projects = [] } = useProjects();
  const { data: items = [] } = useRidacItems(projectId);
  const bulk = useBulkInsertItems();
  const fileRef = useRef<HTMLInputElement>(null);

  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: RidacItem | null }>({
    open: false,
    item: null,
  });
  const [editProject, setEditProject] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  if (!session) return null;

  const counts = summariseCounts(items);

  function exportCsv() {
    const csv = toCsv(
      CSV_HEADERS,
      items.map((i) => [
        i.ref_code,
        i.type,
        i.title,
        i.detail,
        i.owner,
        i.status,
        i.severity,
        i.due_date,
        i.resolution,
      ]),
    );
    downloadCsv(`${project?.code || "project"}-ridac.csv`, csv);
  }

  async function importCsv(file: File) {
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("The file has no data rows.");
      const header = rows[0]!.map((h) => h.trim().toLowerCase());
      const col = (...names: string[]) => {
        for (const n of names) {
          const idx = header.indexOf(n);
          if (idx !== -1) return idx;
        }
        return -1;
      };
      const idx = {
        ref: col("ref", "ref code", "reference", "id"),
        type: col("type", "category"),
        title: col("title", "summary", "description", "name"),
        detail: col("detail", "details", "notes"),
        owner: col("owner", "assignee", "assigned to"),
        status: col("status"),
        severity: col("severity", "impact", "priority"),
        due: col("due date", "due", "target date"),
        resolution: col("resolution", "mitigation", "action"),
      };
      if (idx.title === -1) throw new Error("Could not find a Title column in the file.");

      const get = (r: string[], i: number) => (i === -1 ? "" : (r[i] ?? "").trim());
      const payload = rows
        .slice(1)
        .filter((r) => get(r, idx.title))
        .map((r) => ({
          project_id: projectId,
          ref_code: get(r, idx.ref),
          type: matchOption(get(r, idx.type), RIDAC_TYPES, "Risk"),
          title: get(r, idx.title),
          detail: get(r, idx.detail),
          owner: get(r, idx.owner),
          status: matchOption(get(r, idx.status), STATUSES, "Open"),
          severity: matchOption(get(r, idx.severity), SEVERITIES, "Medium"),
          due_date: get(r, idx.due) || null,
          resolution: get(r, idx.resolution),
        }));

      if (payload.length === 0) throw new Error("No rows with a title were found.");
      await bulk.mutateAsync(payload);
      toast.success(`Imported ${payload.length} rows`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <AppShell
      title={project?.name ?? "Project"}
      meta={
        project && (
          <div className="flex items-center gap-2">
            <MetaChip>{project.code || "—"}</MetaChip>
            <MetaChip>{project.phase}</MetaChip>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2 rounded-full", HEALTH_DOT[project.health])} />
              {project.health}
            </span>
          </div>
        )
      }
      actions={
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            Import CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditProject(true)}>
            Edit project
          </Button>
          <Button size="sm" onClick={() => setItemDialog({ open: true, item: null })}>
            New item
          </Button>
        </>
      }
    >
      {!project ? (
        <p className="text-sm text-muted-foreground">This project no longer exists.</p>
      ) : (
        <>
          {project.description && (
            <p className="max-w-3xl text-sm text-muted-foreground">{project.description}</p>
          )}

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Total items" value={items.length} />
            <Stat label="Open" value={counts.open} />
            <Stat label="Overdue" value={counts.overdue} tone="red" />
            <Stat label="Owner" text={project.owner || "Unassigned"} />
          </section>

          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <RidacTable
              items={items}
              projects={projects}
              onOpen={(item) => setItemDialog({ open: true, item })}
            />
            <AssistantPanel projectId={projectId} />
          </div>
        </>
      )}

      <ItemDialog
        open={itemDialog.open}
        item={itemDialog.item}
        projects={projects}
        defaultProjectId={projectId}
        onOpenChange={(open) => setItemDialog((d) => ({ ...d, open }))}
      />
      <ProjectDialog
        open={editProject}
        project={project ?? null}
        onOpenChange={setEditProject}
      />
    </AppShell>
  );
}

function Stat({
  label,
  value,
  text,
  tone,
}: {
  label: string;
  value?: number;
  text?: string;
  tone?: "red";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {text ? (
        <p className="mt-2 truncate text-lg font-semibold">{text}</p>
      ) : (
        <p
          className={cn("mt-2 font-mono text-3xl font-bold", tone === "red" && "text-status-red")}
        >
          {value}
        </p>
      )}
    </div>
  );
}
