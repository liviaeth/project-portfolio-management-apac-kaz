import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AssistantPanel } from "@/components/AssistantPanel";
import { ItemDialog } from "@/components/ItemDialog";
import { RidacTable } from "@/components/RidacTable";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, useRidacItems } from "@/lib/portfolio";
import { downloadCsv, toCsv, type RidacItem } from "@/lib/ridac";

export const Route = createFileRoute("/ridac")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "RIDAC Central — Stratos PMO" },
      {
        name: "description",
        content:
          "Every risk, issue, decision, action, change request and dependency across the portfolio in one log.",
      },
      { property: "og:title", content: "RIDAC Central — Stratos PMO" },
      {
        property: "og:description",
        content: "Portfolio-wide risks, issues, decisions, actions, changes and dependencies.",
      },
    ],
  }),
  component: RidacCentral,
});

function RidacCentral() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const { data: projects = [] } = useProjects();
  const { data: items = [] } = useRidacItems();
  const [dialog, setDialog] = useState<{ open: boolean; item: RidacItem | null }>({
    open: false,
    item: null,
  });

  if (!session) return null;

  function exportAll() {
    const names = new Map(projects.map((p) => [p.id, p.name]));
    const csv = toCsv(
      [
        "Project",
        "Ref",
        "Type",
        "Title",
        "Detail",
        "Owner",
        "Status",
        "Severity",
        "Due Date",
        "Resolution",
      ],
      items.map((i) => [
        names.get(i.project_id) ?? "",
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
    downloadCsv("portfolio-ridac.csv", csv);
  }

  return (
    <AppShell
      title="RIDAC Central"
      actions={
        <>
          <Button size="sm" variant="outline" onClick={exportAll}>
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setDialog({ open: true, item: null })}>
            New item
          </Button>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <RidacTable
          items={items}
          projects={projects}
          showProject
          onOpen={(item) => setDialog({ open: true, item })}
        />
        <AssistantPanel />
      </div>

      <ItemDialog
        open={dialog.open}
        item={dialog.item}
        projects={projects}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </AppShell>
  );
}
