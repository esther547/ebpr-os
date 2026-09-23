"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";

export type Strategist = { id: string; name: string };

export type CloseGoalValues = { closedById: string; outcome: string };

/** Default closer: the current user when they are a strategist, else the assignee, else the first option. */
export function defaultCloserId(
  strategists: Strategist[],
  currentUserId?: string | null,
  assigneeId?: string | null
): string {
  if (currentUserId && strategists.some((s) => s.id === currentUserId)) return currentUserId;
  if (assigneeId && strategists.some((s) => s.id === assigneeId)) return assigneeId;
  return strategists[0]?.id ?? "";
}

/**
 * "¿Qué estratega cerró esta meta?" — asked every time a goal is closed (status -> COMPLETED).
 *
 * By default it POSTs { status: "COMPLETED", closedById, outcome } to the status endpoint and
 * refreshes the page. Pass `onConfirm` to take over the save (e.g. the detail form, which
 * saves all of its fields together); return false from it to keep the modal open.
 */
export function CloseGoalModal({
  open,
  onOpenChange,
  deliverable,
  strategists,
  currentUserId,
  initialCloserId,
  initialOutcome,
  title = "¿Qué estratega cerró esta meta?",
  confirmLabel = "Confirmar cierre",
  onConfirm,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliverable: { id: string; title: string; outcome?: string | null; assigneeId?: string | null };
  strategists: Strategist[];
  currentUserId?: string | null;
  /** Preselect this strategist (e.g. when changing an existing closer). */
  initialCloserId?: string | null;
  /** Prefill for the outcome box; defaults to the goal's saved outcome. */
  initialOutcome?: string | null;
  title?: string;
  confirmLabel?: string;
  onConfirm?: (values: CloseGoalValues) => Promise<boolean>;
  onClosed?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [closedById, setClosedById] = useState("");
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset the fields every time the modal opens.
  useEffect(() => {
    if (!open) return;
    const preset =
      initialCloserId && strategists.some((s) => s.id === initialCloserId)
        ? initialCloserId
        : defaultCloserId(strategists, currentUserId, deliverable.assigneeId);
    setClosedById(preset);
    setOutcome(initialOutcome ?? deliverable.outcome ?? "");
    setSaving(false);
  }, [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!closedById) return;
    setSaving(true);
    const values = { closedById, outcome: outcome.trim() };
    try {
      if (onConfirm) {
        const ok = await onConfirm(values);
        if (ok) onOpenChange(false);
        return;
      }
      const res = await fetch(`/api/deliverables/${deliverable.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED", closedById: values.closedById, outcome: values.outcome }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "No se pudo cerrar la meta",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        return;
      }
      const name = strategists.find((s) => s.id === values.closedById)?.name;
      toast({ title: "Meta cerrada", description: name ? `Cerrada por ${name}` : undefined, variant: "success" });
      onOpenChange(false);
      onClosed?.();
      router.refresh();
    } catch {
      toast({ title: "Error de red", description: "No se pudo conectar con el servidor", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={deliverable.title} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <FormGroup label="Estratega" htmlFor="close-goal-strategist" required>
          <Select
            id="close-goal-strategist"
            value={closedById}
            onChange={(e) => setClosedById(e.target.value)}
            required
          >
            {strategists.length === 0 && <option value="">No hay estrategas activos</option>}
            {strategists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup label="Resultado / logro" htmlFor="close-goal-outcome" hint="opcional">
          <Textarea
            id="close-goal-outcome"
            rows={3}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="¿Qué se logró? (lo ve el cliente)"
          />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!closedById}>
            {confirmLabel}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
