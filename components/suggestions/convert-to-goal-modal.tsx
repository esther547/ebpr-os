"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button, FormGroup, Select } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { categoryLabel, deliverableTypeFor } from "@/lib/client-suggestions-format";
import type { SuggestionItem, TeamMember } from "./types";

const TYPE_ES: Record<string, string> = {
  PRESS_PLACEMENT: "Prensa",
  INFLUENCER_COLLAB: "Colaboración con creador",
  EVENT_APPEARANCE: "Evento",
  BRAND_OPPORTUNITY: "Marca",
  SOCIAL_MEDIA: "Redes sociales",
  PRESS_RELEASE: "Comunicado",
  OTHER: "Otro",
};

/** "Convertir en meta": pick who owns the goal, then POST .../to-goal. */
export function ConvertToGoalModal({
  suggestion,
  team,
  currentUserId,
  open,
  onOpenChange,
  onConfirm,
}: {
  suggestion: SuggestionItem;
  team: TeamMember[];
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (assigneeId: string) => Promise<boolean>;
}) {
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const ok = await onConfirm(assigneeId);
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Convertir en meta"
      description="Se crea una meta en outreach para el ciclo actual del cliente."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving}>
            Crear meta
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface-1 p-3">
          <p className="text-sm font-medium text-ink-primary">{suggestion.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge size="xs">{categoryLabel(suggestion.category)}</Badge>
            <span className="text-2xs text-ink-muted">Tipo de meta: {TYPE_ES[deliverableTypeFor(suggestion.category)] ?? "Otro"}</span>
          </div>
        </div>
        <FormGroup label="Responsable" htmlFor="sg-assignee" description="La justificación de la sugerencia queda en las notas de la meta.">
          <Select id="sg-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.id === currentUserId ? " (yo)" : ""}
              </option>
            ))}
          </Select>
        </FormGroup>
      </div>
    </Modal>
  );
}
