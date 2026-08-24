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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RIDAC_TYPES, SEVERITIES, STATUSES, type Project, type RidacItem } from "@/lib/ridac";
import { useDeleteItem, useSaveItem } from "@/lib/portfolio";

type Draft = Partial<RidacItem>;

const empty: Draft = {
  type: "Risk",
  title: "",
  detail: "",
  owner: "",
  status: "Open",
  severity: "Medium",
  ref_code: "",
  due_date: null,
  resolution: "",
};

export function ItemDialog({
  open,
  onOpenChange,
  item,
  projects,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: RidacItem | null;
  projects: Project[];
  defaultProjectId?: string;
}) {
  const [draft, setDraft] = useState<Draft>(empty);
  const save = useSaveItem();
  const del = useDeleteItem();

  useEffect(() => {
    if (open) {
      setDraft(item ?? { ...empty, project_id: defaultProjectId ?? projects[0]?.id });
    }
  }, [open, item, defaultProjectId, projects]);

  const set = (patch: Draft) => setDraft((d) => ({ ...d, ...patch }));

  async function submit() {
    if (!draft.title?.trim()) return toast.error("A title is required.");
    if (!draft.project_id) return toast.error("Pick a project.");
    try {
      await save.mutateAsync({ ...draft, due_date: draft.due_date || null });
      toast.success(item ? "Item updated" : "Item added");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the item");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit RIDAC item" : "New RIDAC item"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Project">
            <Picker
              value={draft.project_id ?? ""}
              onChange={(v) => set({ project_id: v })}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
          <Field label="Type">
            <Picker
              value={draft.type ?? "Risk"}
              onChange={(v) => set({ type: v })}
              options={RIDAC_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </Field>
          <Field label="Reference">
            <Input
              value={draft.ref_code ?? ""}
              onChange={(e) => set({ ref_code: e.target.value })}
              placeholder="RSK-001"
            />
          </Field>
          <Field label="Owner">
            <Input
              value={draft.owner ?? ""}
              onChange={(e) => set({ owner: e.target.value })}
              placeholder="A. Patel"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Title">
              <Input
                value={draft.title ?? ""}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Short summary of the item"
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Detail">
              <Textarea
                rows={3}
                value={draft.detail ?? ""}
                onChange={(e) => set({ detail: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Status">
            <Picker
              value={draft.status ?? "Open"}
              onChange={(v) => set({ status: v })}
              options={STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label="Severity">
            <Picker
              value={draft.severity ?? "Medium"}
              onChange={(v) => set({ severity: v })}
              options={SEVERITIES.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label="Due date">
            <Input
              type="date"
              value={draft.due_date ?? ""}
              onChange={(e) => set({ due_date: e.target.value })}
            />
          </Field>
          <Field label="Resolution / mitigation">
            <Input
              value={draft.resolution ?? ""}
              onChange={(e) => set({ resolution: e.target.value })}
            />
          </Field>
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          {item ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                await del.mutateAsync(item.id);
                toast.success("Item deleted");
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function Picker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
