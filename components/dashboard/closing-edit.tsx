"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button, FormActions, FormGroup, Input } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

type Props = { clientId: string; clientName: string; pending: number | null; closed: number; note: string | null; dueLabel: string };

/** Dashboard: correct how many goals a client still owes for the year-end count (or take it out of the count). */
export function ClosingEdit({ clientId, clientName, pending, closed, note, dueLabel }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(pending === null ? "" : String(pending));
  const [draft, setDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);

  async function save(remove = false) {
    const n = Number(value);
    if (!remove && (value.trim() === "" || !Number.isInteger(n) || n < 0)) { toast({ title: "Escribe un número de metas (0 si está al día)", variant: "error" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Stored as of the count date: what is pending today plus what was already secured since then.
        body: JSON.stringify(remove ? { closingOwed: null, closingNote: null } : { closingOwed: n + closed, closingNote: draft.trim() || null }),
      });
      if (!res.ok) throw new Error();
      toast({ title: remove ? `${clientName}: fuera del conteo` : `${clientName}: ${n} meta${n === 1 ? "" : "s"} pendiente${n === 1 ? "" : "s"}`, variant: "success" });
      setOpen(false);
      router.refresh();
    } catch {
      toast({ title: "No se pudo guardar", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={`Editar metas pendientes de ${clientName}`} aria-label={`Editar metas pendientes de ${clientName}`} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink-primary">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <Modal open={open} onOpenChange={setOpen} title={`${clientName}: metas al ${dueLabel}`} description="Cuántas metas le faltan hoy. Baja sola cada vez que se cierra una meta nueva." size="sm">
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-4">
          <FormGroup label="Metas pendientes hoy" htmlFor="ce-n" description="0 = está al día.">
            <Input id="ce-n" type="number" min={0} max={200} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </FormGroup>
          <FormGroup label="Nota" htmlFor="ce-note" description="Opcional.">
            <Input id="ce-note" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="p. ej. Si desea continuar debe renovar" maxLength={200} />
          </FormGroup>
          <FormActions>
            {pending !== null && <Button type="button" variant="ghost" onClick={() => void save(true)} disabled={saving}>Sacar del conteo</Button>}
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" loading={saving}>Guardar</Button>
          </FormActions>
        </form>
      </Modal>
    </>
  );
}
