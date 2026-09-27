"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  Button,
  FormActions,
  FormGroup,
  Input,
  Select,
  Textarea,
} from "@/components/ui/form-field";
import type { ClientOption, PriorityItem, TeamMember } from "./helpers";

export type PriorityDraft = {
  clientId: string | null;
  category?: string | null;
  title: string;
  notes: string | null;
  assigneeId: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null when creating a new line. */
  item: PriorityItem | null;
  clients: ClientOption[];
  teamMembers: TeamMember[];
  /** Boards grouped by category show a category select instead of the client one. */
  categories?: string[];
  /** Preselected client for a new line. */
  defaultClientId?: string | null;
  onSubmit: (draft: PriorityDraft) => Promise<void>;
};

const GENERAL = "__general__";

export function PriorityModal({
  open,
  onOpenChange,
  item,
  clients,
  teamMembers,
  categories,
  defaultClientId = null,
  onSubmit,
}: Props) {
  const [clientId, setClientId] = useState(GENERAL);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientId(item?.clientId ?? defaultClientId ?? GENERAL);
    setCategory(item?.category ?? categories?.[0] ?? "");
    setTitle(item?.title ?? "");
    setNotes(item?.notes ?? "");
    setAssigneeId(item?.assigneeId ?? "");
    setSaving(false);
  }, [open, item, defaultClientId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        clientId: categories ? null : clientId === GENERAL ? null : clientId,
        category: categories ? category || null : undefined,
        title: title.trim(),
        notes: notes.trim() || null,
        assigneeId: assigneeId || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={item ? (categories ? "Editar to do" : "Editar prioridad") : categories ? "Nuevo to do" : "Nueva prioridad"}
      description={
        item || categories ? undefined : "Una línea por prioridad, como en la reunión de los lunes."
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {categories ? (
        <FormGroup label="Categoría" htmlFor="priority-category">
          <Select id="priority-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="">Sin categoría</option>
          </Select>
        </FormGroup>
        ) : (
        <FormGroup label="Cliente" htmlFor="priority-client">
          <Select
            id="priority-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value={GENERAL}>General (agencia)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormGroup>
        )}

        <FormGroup label={categories ? "To do" : "Prioridad"} htmlFor="priority-title" required>
          <Input
            id="priority-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Cerrar YRYS podcast"
            autoFocus
          />
        </FormGroup>

        <FormGroup label="Detalle" htmlFor="priority-notes">
          <Textarea
            id="priority-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional — contexto, fecha, contacto…"
          />
        </FormGroup>

        {teamMembers.length > 0 && (
        <FormGroup label="Responsable" htmlFor="priority-assignee">
          <Select
            id="priority-assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Sin asignar</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </FormGroup>
        )}

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!title.trim()}>
            {item ? "Guardar" : "Agregar"}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}

/** Small dialog to move one line to another client (or to the general list). */
export function MovePriorityModal({
  item,
  clients,
  categories,
  onClose,
  onMove,
}: {
  item: PriorityItem | null;
  clients: ClientOption[];
  /** Boards grouped by category move between categories instead of clients. */
  categories?: string[];
  onClose: () => void;
  onMove: (item: PriorityItem, clientId: string | null, category?: string | null) => Promise<void>;
}) {
  const [clientId, setClientId] = useState(GENERAL);
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setClientId(item.clientId ?? GENERAL);
      setCategory(item.category ?? "");
      setSaving(false);
    }
  }, [item]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || saving) return;
    setSaving(true);
    try {
      if (categories) await onMove(item, null, category || null);
      else await onMove(item, clientId === GENERAL ? null : clientId);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      title={categories ? "Mover a otra categoría" : "Mover a otro cliente"}
      description={item?.title}
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        {categories ? (
        <FormGroup label="Categoría" htmlFor="move-priority-category">
          <Select id="move-priority-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="">Sin categoría</option>
          </Select>
        </FormGroup>
        ) : (
        <FormGroup label="Cliente" htmlFor="move-priority-client">
          <Select
            id="move-priority-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value={GENERAL}>General (agencia)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormGroup>
        )}
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Mover
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
