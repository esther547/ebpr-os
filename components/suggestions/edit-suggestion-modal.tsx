"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button, FormGroup, Input, Textarea } from "@/components/ui/form-field";
import type { SuggestionItem } from "./types";

/** Adjust the wording of a suggestion before working it. */
export function EditSuggestionModal({
  suggestion,
  open,
  onOpenChange,
  onSave,
}: {
  suggestion: SuggestionItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: { title: string; rationale: string }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(suggestion.title);
  const [rationale, setRationale] = useState(suggestion.rationale);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !rationale.trim()) return;
    setSaving(true);
    const ok = await onSave({ title: title.trim(), rationale: rationale.trim() });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Editar sugerencia">
      <form onSubmit={submit} className="space-y-4">
        <FormGroup label="Acción" htmlFor="sg-title" required>
          <Input id="sg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} required />
        </FormGroup>
        <FormGroup label="Por qué" htmlFor="sg-rationale" required>
          <Textarea id="sg-rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} rows={5} maxLength={2000} required />
        </FormGroup>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
