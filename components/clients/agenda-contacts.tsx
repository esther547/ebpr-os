"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, Input, FormGroup, FormActions } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";

type Contact = { id: string; name: string; email: string | null; role: string | null; notifyAgenda: boolean };

/** Who at the client receives the agenda emails (new pauta, changes, cancellations). */
export function AgendaContacts({ clientId, contacts, canEdit }: { clientId: string; contacts: Contact[]; canEdit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const receiving = contacts.filter((c) => c.notifyAgenda && c.email);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/clients/${clientId}/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) { toast({ title: apiErrorMessage(data, "No se pudo guardar"), variant: "error" }); return; }
    router.refresh();
  }
  async function remove(id: string) {
    const res = await fetch(`/api/clients/${clientId}/contacts/${id}`, { method: "DELETE" });
    if (!res.ok) { toast({ title: "No se pudo borrar", variant: "error" }); return; }
    router.refresh();
  }
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: String(f.get("name") || "").trim(), email: String(f.get("email") || "").trim(), role: String(f.get("role") || "").trim() || null, notifyAgenda: true }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast({ title: apiErrorMessage(data, "No se pudo agregar"), variant: "error" }); return; }
      setAdding(false);
      router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <Card padding="lg">
      <CardHeader
        title="Emails de agenda"
        description={receiving.length ? `${receiving.length} contacto${receiving.length === 1 ? "" : "s"} recibe${receiving.length === 1 ? "" : "n"} cada pauta nueva, cambio o cancelación.` : "Nadie recibe todavía los emails de agenda de este cliente."}
        actions={canEdit ? <Button variant="secondary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Agregar email</Button> : undefined}
      />
      {contacts.length === 0 ? (
        <p className="text-sm text-ink-muted">Sin contactos. Agrega el email del cliente para que reciba su agenda.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <Mail className={`h-4 w-4 shrink-0 ${c.notifyAgenda && c.email ? "text-emerald-600" : "text-ink-muted"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-primary">{c.name}{c.role ? <span className="font-normal text-ink-muted"> · {c.role}</span> : null}</p>
                <p className="truncate text-xs text-ink-muted">{c.email ?? "sin email"}</p>
              </div>
              {canEdit && c.email && (
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-ink-secondary">
                  <input type="checkbox" checked={c.notifyAgenda} onChange={(e) => void patch(c.id, { notifyAgenda: e.target.checked })} className="h-4 w-4 rounded border-border-strong accent-ink-primary" />
                  Recibe agenda
                </label>
              )}
              {canEdit && (
                <button type="button" aria-label="Borrar contacto" onClick={() => void remove(c.id)} className="shrink-0 rounded p-1 text-ink-muted hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={adding} onOpenChange={setAdding} title="Agregar email de agenda" description="Recibirá cada pauta nueva, cambio y cancelación, con la fecha y el lugar reales.">
        <form onSubmit={add} className="space-y-4">
          <FormGroup label="Nombre" htmlFor="ct-name"><Input id="ct-name" name="name" required placeholder="Nombre del cliente o de su equipo" /></FormGroup>
          <FormGroup label="Email" htmlFor="ct-email"><Input id="ct-email" name="email" type="email" required /></FormGroup>
          <FormGroup label="Rol" htmlFor="ct-role" hint="Opcional"><Input id="ct-role" name="role" placeholder="Talento, manager, asistente…" /></FormGroup>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Agregar</Button>
          </FormActions>
        </form>
      </Modal>
    </Card>
  );
}
