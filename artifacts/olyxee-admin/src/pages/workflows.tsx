import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Copy, Trash2, Pencil, CheckCircle2, Circle,
  ChevronUp, ChevronDown, Search, X, Zap, Tag,
  AlertTriangle, Loader2, Check, LayoutTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useGetWorkflowTemplates,
  useCreateWorkflowTemplate,
  useUpdateWorkflowTemplate,
  useDeleteWorkflowTemplate,
  useCloneWorkflowTemplate,
  useUpdateWorkflowSteps,
  useGetActiveWorkflow,
  useActivateWorkflow,
  getGetWorkflowTemplatesQueryKey,
  getGetActiveWorkflowQueryKey,
} from "@workspace/api-client-react";
import type { WorkflowTemplateWithSteps, WorkflowStepInput } from "@workspace/api-client-react";
import {
  WORKFLOW_PRESETS,
  findPreset,
  type WorkflowPreset,
  type PresetStep,
} from "@/lib/workflow-presets";
import { useGetBusiness } from "@workspace/api-client-react";

// ─── Step color palette ───────────────────────────────────────────────────────

const STEP_COLORS = [
  { label: "Indigo",  hex: "#6366f1" },
  { label: "Violet",  hex: "#8b5cf6" },
  { label: "Sky",     hex: "#0ea5e9" },
  { label: "Amber",   hex: "#f59e0b" },
  { label: "Rose",    hex: "#ef4444" },
  { label: "Emerald", hex: "#10b981" },
  { label: "Slate",   hex: "#64748b" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditableStep {
  label: string;
  description: string;
  color: string;
  isTerminal: boolean;
  position: number;
}

function defaultStep(position: number): EditableStep {
  return { label: "", description: "", color: "#6366f1", isTerminal: false, position };
}

function presetStepToEditable(s: PresetStep): EditableStep {
  return { label: s.label, description: s.description, color: s.color, isTerminal: s.isTerminal, position: s.position };
}

function dbStepToEditable(s: WorkflowStepInput & { color?: string | null; description?: string | null }): EditableStep {
  return {
    label: s.label,
    description: s.description ?? "",
    color: s.color ?? "#6366f1",
    isTerminal: s.isTerminal,
    position: s.position,
  };
}

// ─── Step timeline display ────────────────────────────────────────────────────

function StepTimeline({ steps }: { steps: Array<{ label: string; color?: string | null; isTerminal: boolean }> }) {
  const sorted = [...steps].sort((a, b) => (a as any).position - (b as any).position);
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {sorted.map((step, i) => (
        <span key={i} className="flex items-center gap-1">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: step.color ?? "#6366f1" }}
          >
            {step.isTerminal && <CheckCircle2 className="h-3 w-3" />}
            {step.label}
          </span>
          {i < sorted.length - 1 && (
            <span className="text-muted-foreground text-[10px]">→</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  name,
  description,
  businessType,
  steps,
  isActive,
  isPreset,
  onActivate,
  onEdit,
  onClone,
  onDelete,
  activating,
}: {
  name: string;
  description?: string | null;
  businessType?: string | null;
  steps: Array<{ label: string; color?: string | null; isTerminal: boolean; position: number }>;
  isActive: boolean;
  isPreset: boolean;
  onActivate: () => void;
  onEdit?: () => void;
  onClone: () => void;
  onDelete?: () => void;
  activating: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 transition-all",
        isActive
          ? "border-foreground bg-foreground/3 shadow-sm"
          : "border-border bg-card hover:border-foreground/30",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-foreground truncate">{name}</p>
            {isActive && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-foreground text-background">
                <Check className="h-2.5 w-2.5" /> Active
              </span>
            )}
            {isPreset && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">System</Badge>
            )}
          </div>
          {businessType && (
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {businessType}
            </p>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
        </div>
      </div>

      {/* Steps timeline */}
      <div className="flex-1">
        <StepTimeline steps={steps} />
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {steps.length} step{steps.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/60">
        {!isActive && (
          <Button
            size="sm"
            variant="outline"
            onClick={onActivate}
            disabled={activating}
            className="h-7 text-xs gap-1"
          >
            {activating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Zap className="h-3 w-3" />
            )}
            Set active
          </Button>
        )}
        {onEdit && (
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-7 text-xs gap-1">
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClone} className="h-7 text-xs gap-1">
          <Copy className="h-3 w-3" /> Clone
        </Button>
        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-7 text-xs gap-1 text-destructive hover:text-destructive ml-auto"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Step row editor ──────────────────────────────────────────────────────────

function StepRow({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: EditableStep;
  index: number;
  total: number;
  onChange: (updated: EditableStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex items-start gap-2 p-3 border border-border rounded-md bg-muted/30">
      {/* Position number */}
      <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          aria-label="Move step up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <span className="text-[11px] font-mono text-muted-foreground w-4 text-center">{index + 1}</span>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          aria-label="Move step down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Color dot selector */}
      <div className="flex flex-col gap-1 shrink-0 pt-1">
        <div className="flex gap-1">
          {STEP_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => onChange({ ...step, color: c.hex })}
              title={c.label}
              className={cn(
                "h-4 w-4 rounded-full border-2 transition-transform",
                step.color === c.hex ? "border-foreground scale-110" : "border-transparent",
              )}
              style={{ backgroundColor: c.hex }}
              aria-label={`Color: ${c.label}`}
            />
          ))}
        </div>
      </div>

      {/* Label + optional description */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <Input
          value={step.label}
          onChange={(e) => onChange({ ...step, label: e.target.value })}
          placeholder="Step label (e.g. Dispatched)"
          className="h-8 text-sm"
          maxLength={100}
        />
        <Input
          value={step.description}
          onChange={(e) => onChange({ ...step, description: e.target.value })}
          placeholder="Description (optional)"
          className="h-7 text-xs text-muted-foreground"
          maxLength={200}
        />
      </div>

      {/* Terminal toggle */}
      <div className="flex flex-col items-center gap-0.5 shrink-0 pt-1">
        <button
          type="button"
          onClick={() => onChange({ ...step, isTerminal: !step.isTerminal })}
          title={step.isTerminal ? "Final step — click to unset" : "Mark as final step"}
          className={cn(
            "transition-colors",
            step.isTerminal ? "text-emerald-600" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {step.isTerminal ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>
        <span className="text-[9px] text-muted-foreground">Final</span>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 pt-1.5"
        aria-label="Remove step"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Template Editor Modal ────────────────────────────────────────────────────

function TemplateEditorModal({
  open,
  onClose,
  initial,
  templateId, // defined when editing an existing template
}: {
  open: boolean;
  onClose: () => void;
  initial: { name: string; description: string; businessType: string; steps: EditableStep[] };
  templateId?: string;
}) {
  const queryClient = useQueryClient();
  const createMutation = useCreateWorkflowTemplate();
  const updateMutation = useUpdateWorkflowTemplate();
  const stepsMutation = useUpdateWorkflowSteps();

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [businessType, setBusinessType] = useState(initial.businessType);
  const [steps, setSteps] = useState<EditableStep[]>(initial.steps);

  const isEditing = !!templateId;

  function addStep() {
    setSteps((prev) => [...prev, defaultStep(prev.length)]);
  }

  function updateStep(index: number, updated: EditableStep) {
    setSteps((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i })));
  }

  function moveStep(index: number, direction: "up" | "down") {
    const next = [...steps];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next.map((s, i) => ({ ...s, position: i })));
  }

  const stepsPayload = steps.map((s, i) => ({
    label: s.label,
    description: s.description || undefined,
    position: i,
    color: s.color,
    isTerminal: s.isTerminal,
  }));

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Template name is required.");
      return;
    }
    const emptyLabel = steps.find((s) => !s.label.trim());
    if (emptyLabel) {
      toast.error("All steps must have a label.");
      return;
    }
    if (steps.length === 0) {
      toast.error("Add at least one step.");
      return;
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: templateId,
          data: {
            name: name.trim(),
            description: description.trim() || null,
            businessType: businessType.trim() || null,
          },
        });
        await stepsMutation.mutateAsync({ id: templateId, data: { steps: stepsPayload } });
        toast.success("Template saved");
      } else {
        await createMutation.mutateAsync({
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            businessType: businessType.trim() || undefined,
            steps: stepsPayload,
          },
        });
        toast.success("Template created");
      }
      queryClient.invalidateQueries({ queryKey: getGetWorkflowTemplatesQueryKey() });
      onClose();
    } catch {
      toast.error("Could not save template. Please try again.");
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending || stepsMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Template" : "New Workflow Template"}</DialogTitle>
          <DialogDescription>
            Define the steps your team follows for each order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Template name <span className="text-destructive">*</span></Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Express Delivery"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">Description <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of when to use this template"
              maxLength={200}
            />
          </div>

          {/* Business type tag */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-type">Business type tag <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="tpl-type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g. Logistics Company"
              maxLength={60}
            />
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Steps{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  ({steps.length}/50) — click <CheckCircle2 className="h-3 w-3 inline text-emerald-600" /> to mark the final step
                </span>
              </Label>
            </div>

            {steps.length === 0 ? (
              <div className="border border-dashed border-border rounded-md py-8 text-center text-sm text-muted-foreground">
                No steps yet. Add your first step below.
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <StepRow
                    key={i}
                    step={step}
                    index={i}
                    total={steps.length}
                    onChange={(updated) => updateStep(i, updated)}
                    onRemove={() => removeStep(i)}
                    onMoveUp={() => moveStep(i, "up")}
                    onMoveDown={() => moveStep(i, "down")}
                  />
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addStep}
              disabled={steps.length >= 50}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add step
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending} className="gap-1.5">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><Check className="h-4 w-4" /> Save template</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Clone Dialog ─────────────────────────────────────────────────────────────

function CloneDialog({
  open,
  onClose,
  source,
}: {
  open: boolean;
  onClose: () => void;
  source: { name: string; businessType?: string | null; steps: PresetStep[] | WorkflowStepInput[] };
}) {
  const queryClient = useQueryClient();
  const cloneMutation = useCloneWorkflowTemplate();
  const [cloneName, setCloneName] = useState(`${source.name} (copy)`);

  async function handleClone() {
    if (!cloneName.trim()) return;
    try {
      await cloneMutation.mutateAsync({
        data: {
          name: cloneName.trim(),
          businessType: source.businessType ?? undefined,
          steps: (source.steps as any[]).map((s, i) => ({
            label: s.label,
            description: s.description ?? undefined,
            position: i,
            color: s.color ?? undefined,
            isTerminal: s.isTerminal ?? false,
          })),
        },
      });
      toast.success("Template cloned");
      queryClient.invalidateQueries({ queryKey: getGetWorkflowTemplatesQueryKey() });
      onClose();
    } catch {
      toast.error("Could not clone template.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Clone Template</DialogTitle>
          <DialogDescription>Enter a name for the new template.</DialogDescription>
        </DialogHeader>
        <Input
          value={cloneName}
          onChange={(e) => setCloneName(e.target.value)}
          placeholder="New template name"
          maxLength={100}
          onKeyDown={(e) => e.key === "Enter" && handleClone()}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleClone} disabled={cloneMutation.isPending || !cloneName.trim()}>
            {cloneMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const queryClient = useQueryClient();

  const { data: business } = useGetBusiness();
  const templatesQuery = useGetWorkflowTemplates();
  const activeQuery = useGetActiveWorkflow();
  const activateMutation = useActivateWorkflow();
  const deleteMutation = useDeleteWorkflowTemplate();

  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplateWithSteps | null>(null);
  const [cloningSource, setCloningSource] = useState<null | {
    name: string; businessType?: string | null; steps: any[]
  }>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const activeTemplateId = activeQuery.data?.templateId;

  // Resolve the active template display info
  const activePreset = activeTemplateId ? findPreset(activeTemplateId) : null;
  const activeDbTemplate = activeTemplateId && !activePreset
    ? templatesQuery.data?.find((t) => t.id === activeTemplateId)
    : null;
  const activeSteps = activePreset?.steps ?? activeDbTemplate?.steps ?? [];
  const activeName = activePreset?.name ?? activeDbTemplate?.name ?? activeQuery.data?.templateName;

  // Auto-suggest preset for this business's industry on first visit
  const suggestedPresetId = business?.industry
    ? WORKFLOW_PRESETS.find((p) => p.businessType === business.industry)?.id
    : undefined;

  const q = search.toLowerCase();
  const filteredPresets = useMemo(
    () => WORKFLOW_PRESETS.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.businessType.toLowerCase().includes(q),
    ),
    [q],
  );
  const filteredCustom = useMemo(
    () => (templatesQuery.data ?? []).filter(
      (t) => !q || t.name.toLowerCase().includes(q) || (t.businessType?.toLowerCase() ?? "").includes(q),
    ),
    [templatesQuery.data, q],
  );

  async function handleActivate(templateId: string, templateName: string) {
    setActivatingId(templateId);
    try {
      await activateMutation.mutateAsync({ data: { templateId, templateName } });
      queryClient.invalidateQueries({ queryKey: getGetActiveWorkflowQueryKey() });
      toast.success(`"${templateName}" is now the active workflow`);
    } catch {
      toast.error("Could not set active workflow.");
    } finally {
      setActivatingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetWorkflowTemplatesQueryKey() });
      toast.success("Template deleted");
    } catch {
      toast.error("Could not delete template.");
    } finally {
      setDeletingId(null);
    }
  }

  function openNewEditor() {
    setEditingTemplate(null);
    setEditorOpen(true);
  }

  function openEditEditor(template: WorkflowTemplateWithSteps) {
    setEditingTemplate(template);
    setEditorOpen(true);
  }

  const editorInitial = editingTemplate
    ? {
        name: editingTemplate.name,
        description: editingTemplate.description ?? "",
        businessType: editingTemplate.businessType ?? "",
        steps: editingTemplate.steps
          .sort((a, b) => a.position - b.position)
          .map(dbStepToEditable),
      }
    : { name: "", description: "", businessType: "", steps: [] };

  return (
    <div className="min-h-full pb-16">
      {/* Page header */}
      <header className="mb-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-500">
        <h1 className="text-3xl font-semibold tracking-tight">Workflow Templates</h1>
        <p className="text-muted-foreground mt-1.5 text-[15px]">
          Define the steps your team follows for every order. Assign a template to make it active.
        </p>
      </header>

      {/* Active template banner */}
      <section className="mb-8">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground">
                  <Zap className="h-3 w-3 text-background" />
                </span>
                <p className="text-sm font-semibold">Active workflow</p>
              </div>

              {activeQuery.isLoading ? (
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              ) : activeQuery.isError || !activeTemplateId ? (
                <div>
                  <p className="text-sm text-muted-foreground">No workflow assigned yet.</p>
                  {suggestedPresetId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Suggested for your business type:{" "}
                      <button
                        type="button"
                        onClick={() => {
                          const p = findPreset(suggestedPresetId)!;
                          handleActivate(p.id, p.name);
                        }}
                        className="underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        {findPreset(suggestedPresetId)?.name}
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{activeName}</p>
                  <StepTimeline steps={activeSteps as any} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Library header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Template Library</h2>
        <Button onClick={openNewEditor} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New template
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="pl-9 pr-8 h-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* System presets */}
      {filteredPresets.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              System Templates
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPresets.map((preset) => (
              <TemplateCard
                key={preset.id}
                name={preset.name}
                description={preset.description}
                businessType={preset.businessType}
                steps={preset.steps}
                isActive={activeTemplateId === preset.id}
                isPreset
                activating={activatingId === preset.id}
                onActivate={() => handleActivate(preset.id, preset.name)}
                onClone={() => setCloningSource({ name: preset.name, businessType: preset.businessType, steps: preset.steps })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom templates */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Your Templates
          </h3>
        </div>

        {templatesQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 rounded-lg border border-border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : filteredCustom.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <LayoutTemplate className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? `No custom templates match "${search}".` : "No custom templates yet."}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground mt-1">
                Clone a system template or create one from scratch.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCustom.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                name={tpl.name}
                description={tpl.description}
                businessType={tpl.businessType}
                steps={tpl.steps}
                isActive={activeTemplateId === tpl.id}
                isPreset={false}
                activating={activatingId === tpl.id}
                onActivate={() => handleActivate(tpl.id, tpl.name)}
                onEdit={() => openEditEditor(tpl)}
                onClone={() => setCloningSource({ name: tpl.name, businessType: tpl.businessType, steps: tpl.steps })}
                onDelete={() => setDeletingId(tpl.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Template Editor Modal */}
      {editorOpen && (
        <TemplateEditorModal
          open={editorOpen}
          onClose={() => { setEditorOpen(false); setEditingTemplate(null); }}
          initial={editorInitial}
          templateId={editingTemplate?.id}
        />
      )}

      {/* Clone Dialog */}
      {cloningSource && (
        <CloneDialog
          open={!!cloningSource}
          onClose={() => setCloningSource(null)}
          source={cloningSource}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete template?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template and all its steps. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
