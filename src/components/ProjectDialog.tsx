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
import { HEALTHS, PHASES, PRIORITIES, type Project } from "@/lib/ridac";
import { useDeleteProject, useSaveProject } from "@/lib/portfolio";

type Draft = Partial<Project>;

const empty: Draft = {
  name: "",
  code: "",
  description: "",
  phase: "Design",
  health: "Green",
  priority: "Medium",
  owner: "",
  start_date: null,
  target_date: null,
};

export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: Project | null;
}) {
  const [draft, setDraft] = useState<Draft>(empty);
  const save = useSaveProject();
  const del = useDeleteProject();

  useEffect(() => {
    if (open) setDraft(project ?? empty);
  }, [open, project]);

  const set = (patch: Draft) => setDraft((d) => ({ ...d, ...patch }));

  async function submit() {
    if (!draft.name?.trim()) return toast.error("A project name is required.");
    try {
      await save.mutateAsync({
        ...draft,
        start_date: draft.start_date || null,
        target_date: draft.target_date || null,
      });
      toast.success(project ? "Project updated" : "Project added");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the project");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <Input value={draft.name ?? ""} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Code">
            <Input
              value={draft.code ?? ""}
              onChange={(e) => set({ code: e.target.value })}
              placeholder="PHX"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Description">
              <Textarea
                rows={2}
                value={draft.description ?? ""}
                onChange={(e) => set({ description: e.target.value })}
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
          <Field label="Health">
            <Picker
              value={draft.health ?? "Green"}
              onChange={(v) => set({ health: v })}
              options={HEALTHS.map((h) => ({ value: h, label: h }))}
            />
          </Field>
          <Field label="Priority">
            <Picker
              value={draft.priority ?? "Medium"}
              onChange={(v) => set({ priority: v })}
              options={PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </Field>
          <Field label="Owner">
            <Input value={draft.owner ?? ""} onChange={(e) => set({ owner: e.target.value })} />
          </Field>
          <Field label="Start date">
            <Input
              type="date"
              value={draft.start_date ?? ""}
              onChange={(e) => set({ start_date: e.target.value })}
            />
          </Field>
          <Field label="Target date">
            <Input
              type="date"
              value={draft.target_date ?? ""}
              onChange={(e) => set({ target_date: e.target.value })}
            />
          </Field>
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          {project ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                await del.mutateAsync(project.id);
                toast.success("Project deleted");
                onOpenChange(false);
              }}
            >
              Delete project
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
