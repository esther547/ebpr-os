"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Undo2 } from "lucide-react";
import { Button, FormActions, FormGroup, Input } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

type Props = {
  clientId: string;
  clientName: string;
  year: number;
  month: number;
  isComplete: boolean;
  note: string | null;
};

/** Dashboard: mark a client's month as complete by hand (e.g. it doubled up the month before). */
export function MonthCompleteToggle({ clientId, clientName, year, month, isComplete, note }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);

  async function save(next: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/month-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, isComplete: next, note: draft.trim() || null }),
      });
      if (!res.ok) throw new Error();
      toast({ title: next ? `${clientName}: mes marcado como completo` : `${clientName}: marca quitada`, variant: "success" });
      setOpen(false);
      router.refresh();
    } catch {
      toast({ title: "No se pudo guardar", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (isComplete) {
    return (
      <Button size="sm" variant="ghost" leftIcon={<Undo2 className="h-3.5 w-3.5" />} onClick={() => void save(false)} loading={saving} title={note ?? "Marcado a mano como completo"}>
        Quitar marca
      </Button>
    );
  }
  return (
    <>
      <Button size="sm" variant="secondary" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
        Marcar completo
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={`Marcar ${clientName} como completo`} description="Este mes queda como cumplido aunque las metas registradas no lleguen a la cuota." size="sm">
        <form onSubmit={(e) => { e.preventDefault(); void save(true); }} className="space-y-4">
          <FormGroup label="Motivo" htmlFor="mc-note" description="Opcional. Se guarda en el historial del cliente.">
            <Input id="mc-note" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="p. ej. Se adelantó doble en septiembre" autoFocus />
          </FormGroup>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" loading={saving}>Marcar completo</Button>
          </FormActions>
        </form>
      </Modal>
    </>
  );
}
