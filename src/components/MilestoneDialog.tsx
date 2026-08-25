import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Picker } from "@/components/ItemDialog";
import { MILESTONE_STATUSES, PHASES, type Milestone } from "@/lib/ridac";
import { useDeleteMilestone, useSaveMilestone } from "@/lib/portfolio";

type Draft = Partial<Milestone>;

const empty: Draft = {
  name: "",
  detail: "",
  owner: "",
  phase: "Design",
  status: "Not Started",
  progress: 0,
  start_date: null,
  end_date: null,
  sort_order: 0,
};

export function MilestoneDialog({
  open,
  onOpenChange,
  milestone,
  projectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  milestone: Milestone | null;
  projectId: string;
}) {
  const [draft, setDraft] = useState<Draft>(empty);
  const save = useSaveMilestone();
  const del = useDeleteMilestone();

  useEffect(() => {
    if (open) setDraft(milestone ?? { ...empty, project_id: projectId });
  }, [open, milestone, projectId]);

  const set = (patch: Draft) => setDraft((d) => ({ ...d, ...patch }));

  async function submit() {
    if (!draft.name?.trim()) {
      toast.error("A milestone name is required.");
      return;
    }
    if (!draft.start_date || !draft.end_date) {
      toast.error("Start and end dates are required for the Gantt chart.");
      return;
    }
    if (draft.end_date < draft.start_date) {
      toast.error("The end date must be on or after the start date.");
      return;
    }
    try {
      await save.mutateAsync({
        ...draft,
        project_id: draft.project_id ?? projectId,
        progress: Math.max(0, Math.min(100, Number(draft.progress) || 0)),
      });
      toast.success(milestone ? "Milestone updated" : "Milestone added");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the milestone");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{milestone ? "Edit milestone" : "New milestone"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Name">
              <Input
                value={draft.name ?? ""}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Design sign-off"
              />
            </Field>
          </div>
          <Field label="Phase">
            <Picker
              value={draft.phase ?? "Design"}
              onChange={(v) => set({ phase: v })}
              options={PHASES.map((p) => ({ value: p, label: p }))}
            />
          </Field>
          <Field label="Status">
            <Picker
              value={draft.status ?? "Not Started"}
              onChange={(v) => set({ status: v })}
              options={MILESTONE_STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label="Start date">
            <Input
              type="date"
              value={draft.start_date ?? ""}
              onChange={(e) => set({ start_date: e.target.value })}
            />
          </Field>
          <Field label="End date">
            <Input
              type="date"
              value={draft.end_date ?? ""}
              onChange={(e) => set({ end_date: e.target.value })}
            />
          </Field>
          <Field label="Owner">
            <Input
              value={draft.owner ?? ""}
              onChange={(e) => set({ owner: e.target.value })}
              placeholder="A. Patel"
            />
          </Field>
          <Field label="Progress (%)">
            <Input
              type="number"
              min={0}
              max={100}
              value={draft.progress ?? 0}
              onChange={(e) => set({ progress: Number(e.target.value) })}
            />
          </Field>
          <div className="col-span-2">
            <Field label="Detail">
              <Textarea
                rows={2}
                value={draft.detail ?? ""}
                onChange={(e) => set({ detail: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          {milestone ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                await del.mutateAsync(milestone.id);
                toast.success("Milestone deleted");
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
