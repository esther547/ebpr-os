"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button, FormActions, FormGroup, Input } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

type Props = {
  clientId: string;
  clientName: string;
  /** November part pending today (the whole count while it is not split); null = client not in the count. */
  pending: number | null;
  /** December part pending today; null = no December number. */
  pendingDec?: number | null;
  /** New goals secured since the count (all of them). */
  closed: number;
  /** November's stored number: when November is already covered, the rest of `closed` counts for December. */
  owedNov?: number;
  note: string | null;
  hold: boolean;
  dueLabel: string;
  /** The count is split in November / December: label the first number as November's. */
  split?: boolean;
};

/** Dashboard: correct how many goals a client still owes for the year-end count (or take it out of the count). */
export function ClosingEdit({ clientId, clientName, pending, pendingDec = null, closed, owedNov = 0, note, hold, dueLabel, split = false }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(pending === null ? "" : String(pending));
  const [december, setDecember] = useState(pendingDec === null ? "" : String(pendingDec));
  const [draft, setDraft] = useState(note ?? "");
  const [onHold, setOnHold] = useState(hold);
  const [saving, setSaving] = useState(false);

  async function save(remove = false) {
    const n = Number(value);
    const d = december.trim() === "" ? null : Number(december);
    if (!remove && (value.trim() === "" || !Number.isInteger(n) || n < 0)) { toast({ title: "Escribe un número de metas (0 si está al día)", variant: "error" }); return; }
    if (!remove && d !== null && (!Number.isInteger(d) || d < 0)) { toast({ title: "Diciembre: escribe un número de metas o déjalo vacío", variant: "error" }); return; }
    // Stored as of the count date: what is pending today plus what was already secured since then. New goals pay
    // November first, so with November still open nothing has been advanced for December.
    const coveredNov = Math.min(closed, owedNov);
    const nov = n > 0 ? n + closed : pending === 0 ? coveredNov : closed;
    const dec = d === null ? null : d + (n > 0 ? 0 : closed - nov);
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(remove ? { closingOwed: null, closingOwedDec: null, closingNote: null, closingHold: false } : { closingOwed: nov, closingOwedDec: dec, closingNote: draft.trim() || null, closingHold: onHold }),
      });
      if (!res.ok) throw new Error();
      toast({ title: remove ? `${clientName}: fuera del conteo` : `${clientName}: ${n} meta${n === 1 ? "" : "s"} pendiente${n === 1 ? "" : "s"}${d !== null ? ` de noviembre y ${d} de diciembre` : ""}`, variant: "success" });
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
          <FormGroup label={split ? "Noviembre: metas pendientes hoy" : "Metas pendientes hoy"} htmlFor="ce-n" description="0 = está al día.">
            <Input id="ce-n" type="number" min={0} max={200} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </FormGroup>
          <FormGroup label="Diciembre (1 al 15): metas pendientes" htmlFor="ce-d" description={split ? "Se cuentan aparte de noviembre. Vacío = no tiene metas de diciembre." : "Opcional. Al poner un número, el dashboard separa noviembre y diciembre."}>
            <Input id="ce-d" type="number" min={0} max={200} value={december} onChange={(e) => setDecember(e.target.value)} />
          </FormGroup>
          <FormGroup label="Nota" htmlFor="ce-note" description="Opcional.">
            <Input id="ce-note" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="p. ej. Si desea continuar debe renovar" maxLength={200} />
          </FormGroup>
          <label className="flex items-start gap-2 text-sm text-ink-secondary">
            <input type="checkbox" checked={onHold} onChange={(e) => setOnHold(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
            <span>Cliente en hold <span className="text-ink-muted">(se le deben, pero no suman a lo que hay que cerrar ahora)</span></span>
          </label>
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
