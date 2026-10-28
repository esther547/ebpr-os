"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Pencil, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, FormActions, FormGroup, Input, Select, Textarea } from "@/components/ui/form-field";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { CLIENT_STATUSES, CLIENT_STATUS_LABELS, CLIENT_STATUS_TONES, type ClientStatus, type EventClientRow, type EventRow } from "@/lib/logistics-shared";

type Option = { id: string; name: string };
type Props = { group: string; title: string; initialEvents: EventRow[]; clients: Option[] };

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");
async function readError(res: Response, fallback: string) { try { return apiErrorMessage(await res.json(), fallback); } catch { return fallback; } }

export function LogisticsBoard({ group, title, initialEvents, clients }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [events, setEvents] = useState(initialEvents);
  useEffect(() => setEvents(initialEvents), [initialEvents]);
  const [q, setQ] = useState("");
  const [clientF, setClientF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [removing, setRemoving] = useState<EventRow | null>(null);
  const [clientEdit, setClientEdit] = useState<{ event: EventRow; row: EventClientRow | null } | null>(null);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return events.filter((e) => (!clientF || e.clients.some((c) => c.client.id === clientF)) && (!s || [e.name, e.venue, e.contact, e.notes, ...e.clients.map((c) => c.client.name)].some((v) => v?.toLowerCase().includes(s))));
  }, [events, q, clientF]);

  const approved = events.flatMap((e) => e.clients).filter((c) => c.status === "APPROVED").length;
  const notApproved = events.flatMap((e) => e.clients).filter((c) => c.status === "NOT_APPROVED").length;
  const pending = events.flatMap((e) => e.clients).filter((c) => c.status === "PENDING").length;
  const replace = (row: EventRow) => { setEvents((prev) => prev.map((e) => (e.id === row.id ? row : e))); setClientEdit((ce) => (ce && ce.event.id === row.id ? { event: row, row: ce.row ? row.clients.find((c) => c.id === ce.row!.id) ?? null : null } : ce)); };

  async function saveClient(event: EventRow, body: Record<string, unknown>) {
    const res = await fetch(`/api/logistics-events/${event.id}/clients`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!res || !res.ok) { toast({ title: "No se pudo guardar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return false; }
    replace((await res.json()).data); router.refresh(); return true;
  }
  async function removeClient(event: EventRow, clientId: string) {
    const res = await fetch(`/api/logistics-events/${event.id}/clients`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) }).catch(() => null);
    if (!res || !res.ok) { toast({ title: "No se pudo quitar", variant: "error" }); return; }
    const data = (await res.json()).data; if (data) replace(data); router.refresh();
  }
  async function removeEvent(e: EventRow) {
    const res = await fetch(`/api/logistics-events/${e.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) { toast({ title: "No se pudo borrar", variant: "error" }); return false; }
    setEvents((prev) => prev.filter((x) => x.id !== e.id)); router.refresh(); return true;
  }

  const ClientChips = ({ event, rows }: { event: EventRow; rows: EventClientRow[] }) => rows.length === 0 ? <span className="text-xs text-ink-muted">—</span> : (
    <ul className="space-y-1.5">
      {rows.map((c) => (
        <li key={c.id}>
          <button type="button" onClick={() => setClientEdit({ event, row: c })} className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-left hover:bg-surface-muted" title="Editar logística">
            <div className="text-sm font-medium">{c.client.name}</div>
            <div className="mt-0.5 space-y-0.5 text-[11px] text-ink-secondary">
              <div><span className="font-semibold text-ink-muted">PR:</span> {c.pr || <span className="text-ink-muted">por definir</span>}</div>
              <div><span className="font-semibold text-ink-muted">Travel:</span> {c.travelExpenses || <span className="text-ink-muted">por definir</span>}</div>
              {c.notes && <div className="text-ink-muted">{c.notes}</div>}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader eyebrow="Logística" title={title} subtitle="Evento · Contacto · Clientes aprobados · Clientes no aprobados. Toca un cliente para editar su PR y sus travel expenses."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>Nuevo evento</Button>}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Evento, lugar, contacto, cliente…" className="h-9 pl-9 text-sm" /></div>
          <Select value={clientF} onChange={(e) => setClientF(e.target.value)} className="h-9 w-auto text-sm" aria-label="Cliente"><option value="">Todos los clientes</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Eventos" value={events.length} icon={<CalendarDays className="h-4 w-4" />} />
        <StatTile label="Clientes aprobados" value={approved} tone={approved ? "success" : "neutral"} icon={<Users className="h-4 w-4" />} />
        <StatTile label="No aprobados" value={notApproved} tone={notApproved ? "danger" : "neutral"} />
        <StatTile label="Por confirmar" value={pending} tone={pending ? "warning" : "neutral"} />
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title={events.length === 0 ? "Todavía no hay eventos" : "Nada coincide"} description="Agrega cada evento de la semana, su contacto, y luego los clientes aprobados y no aprobados con su logística." action={<Button onClick={() => setShowCreate(true)}>Nuevo evento</Button>} />
      ) : (
        <TableWrap>
          <Table>
            <thead><tr><Th>Evento</Th><Th>Contacto</Th><Th>Clientes aprobados</Th><Th>Clientes no aprobados</Th><Th>Por confirmar</Th><Th></Th></tr></thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id} className="align-top">
                  <Td className="min-w-[220px]">
                    <div className="font-semibold">{e.name}</div>
                    {(e.eventDate || e.eventTime) && <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-secondary"><CalendarDays className="h-3 w-3" /> {[fmtDate(e.eventDate), e.eventTime].filter(Boolean).join(" · ")}</div>}
                    {e.venue && <div className="flex items-center gap-1 text-xs text-ink-secondary"><MapPin className="h-3 w-3" /> {e.venue}</div>}
                    {e.notes && <div className="mt-1 max-w-xs text-xs text-ink-muted line-clamp-3" title={e.notes}>{e.notes}</div>}
                    <button type="button" onClick={() => setClientEdit({ event: e, row: null })} className="mt-2 inline-flex items-center gap-1 text-xs text-ink-secondary underline"><UserPlus className="h-3 w-3" /> Agregar cliente</button>
                  </Td>
                  <Td className="max-w-[200px] whitespace-pre-wrap text-xs text-ink-secondary">{e.contact || <span className="text-ink-muted">—</span>}</Td>
                  <Td className="min-w-[220px]"><ClientChips event={e} rows={e.clients.filter((c) => c.status === "APPROVED")} /></Td>
                  <Td className="min-w-[220px]"><ClientChips event={e} rows={e.clients.filter((c) => c.status === "NOT_APPROVED")} /></Td>
                  <Td className="min-w-[180px]"><ClientChips event={e} rows={e.clients.filter((c) => c.status === "PENDING")} /></Td>
                  <Td><div className="flex gap-0.5">
                    <Button size="icon-sm" variant="ghost" aria-label="Editar evento" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Borrar evento" onClick={() => setRemoving(e)}><Trash2 className="h-4 w-4" /></Button>
                  </div></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <EventModal open={showCreate || !!editing} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditing(null); } }} group={group} event={editing}
        onSaved={(row, isNew) => { setEvents((prev) => (isNew ? [...prev, row] : prev.map((x) => (x.id === row.id ? row : x)))); setShowCreate(false); setEditing(null); router.refresh(); }} />
      <ClientModal state={clientEdit} clients={clients} onClose={() => setClientEdit(null)} onSave={saveClient} onRemove={removeClient} />
      <ConfirmModal open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title="Borrar evento" description={removing ? `Se borra "${removing.name}" con la logística de sus clientes.` : ""} confirmLabel="Borrar" destructive onConfirm={async () => { if (removing && (await removeEvent(removing))) setRemoving(null); }} />
    </>
  );
}

function EventModal({ open, onOpenChange, group, event, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; group: string; event: EventRow | null; onSaved: (row: EventRow, isNew: boolean) => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const isEdit = !!event;
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget); const g = (k: string) => ((fd.get(k) as string | null) ?? "").trim() || null;
    const body = { group, name: g("name") ?? "", eventDate: g("eventDate"), eventTime: g("eventTime"), venue: g("venue"), contact: g("contact"), notes: g("notes") };
    setSaving(true);
    const res = await fetch(isEdit ? `/api/logistics-events/${event!.id}` : "/api/logistics-events", { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) { toast({ title: "No se pudo guardar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return; }
    toast({ title: isEdit ? "Evento actualizado" : "Evento agregado", variant: "success" }); onSaved((await res.json()).data, !isEdit);
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={isEdit ? "Editar evento" : "Nuevo evento"} description={isEdit ? event!.name : "El evento, cuándo y dónde es, y el contacto con quien se coordina."} size="lg">
      <form key={event?.id ?? "new"} onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Evento" htmlFor="le-name" required><Input id="le-name" name="name" defaultValue={event?.name} required autoFocus placeholder="Latin Grammy Person of the Year Gala" /></FormGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormGroup label="Fecha" htmlFor="le-date"><Input id="le-date" name="eventDate" type="date" defaultValue={event?.eventDate ? event.eventDate.slice(0, 10) : ""} /></FormGroup>
          <FormGroup label="Hora" htmlFor="le-time"><Input id="le-time" name="eventTime" defaultValue={event?.eventTime ?? ""} placeholder="7:00 PM" /></FormGroup>
          <FormGroup label="Lugar" htmlFor="le-venue"><Input id="le-venue" name="venue" defaultValue={event?.venue ?? ""} /></FormGroup>
        </div>
        <FormGroup label="Contacto" htmlFor="le-contact" hint="nombre, email, teléfono"><Textarea id="le-contact" name="contact" rows={2} defaultValue={event?.contact ?? ""} /></FormGroup>
        <FormGroup label="Notas" htmlFor="le-notes"><Textarea id="le-notes" name="notes" rows={3} defaultValue={event?.notes ?? ""} /></FormGroup>
        <FormActions><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando…" : isEdit ? "Guardar" : "Agregar"}</Button></FormActions>
      </form>
    </Modal>
  );
}

function ClientModal({ state, clients, onClose, onSave, onRemove }: { state: { event: EventRow; row: EventClientRow | null } | null; clients: Option[]; onClose: () => void; onSave: (event: EventRow, body: Record<string, unknown>) => Promise<boolean>; onRemove: (event: EventRow, clientId: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const row = state?.row ?? null; const event = state?.event ?? null;
  const taken = new Set(event?.clients.map((c) => c.client.id) ?? []);
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!event) return;
    const fd = new FormData(e.currentTarget); const g = (k: string) => ((fd.get(k) as string | null) ?? "").trim() || null;
    setSaving(true);
    const ok = await onSave(event, { clientId: row?.client.id ?? g("clientId"), status: g("status") ?? "PENDING", pr: g("pr"), travelExpenses: g("travelExpenses"), notes: g("notes") });
    setSaving(false); if (ok) onClose();
  }
  return (
    <Modal open={!!state} onOpenChange={(o) => !o && onClose()} title={row ? `${row.client.name} · ${event?.name}` : `Agregar cliente · ${event?.name ?? ""}`} description="Estatus del cliente en este evento y su logística: PR y travel expenses." size="lg">
      {event && (
        <form key={row?.id ?? `new-${event.id}`} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {row ? <FormGroup label="Cliente"><Input value={row.client.name} disabled /></FormGroup> : (
              <FormGroup label="Cliente" htmlFor="lc-client" required><Select id="lc-client" name="clientId" required defaultValue=""><option value="">Elige…</option>{clients.filter((c) => !taken.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></FormGroup>
            )}
            <FormGroup label="Estatus" htmlFor="lc-status"><Select id="lc-status" name="status" defaultValue={row?.status ?? "PENDING"}>{CLIENT_STATUSES.map((s) => <option key={s} value={s}>{CLIENT_STATUS_LABELS[s]}</option>)}</Select></FormGroup>
          </div>
          <FormGroup label="PR" htmlFor="lc-pr" hint="quién cubre, credenciales, +1, alfombra…"><Textarea id="lc-pr" name="pr" rows={2} defaultValue={row?.pr ?? ""} placeholder="Cubierto por el evento · credencial para 1 acompañante" /></FormGroup>
          <FormGroup label="Travel expenses" htmlFor="lc-travel" hint="vuelos, hotel, quién paga, montos"><Textarea id="lc-travel" name="travelExpenses" rows={2} defaultValue={row?.travelExpenses ?? ""} placeholder="Vuelo + 2 noches a cargo del cliente" /></FormGroup>
          <FormGroup label="Notas" htmlFor="lc-notes"><Textarea id="lc-notes" name="notes" rows={2} defaultValue={row?.notes ?? ""} /></FormGroup>
          {row && <div className="flex items-center gap-2 text-xs"><Badge tone={CLIENT_STATUS_TONES[row.status as ClientStatus] ?? "neutral"}>{CLIENT_STATUS_LABELS[row.status as ClientStatus] ?? row.status}</Badge><span className="text-ink-muted">actual</span></div>}
          <FormActions>
            {row && <Button type="button" variant="ghost" className="mr-auto text-red-600" onClick={async () => { await onRemove(event, row.client.id); onClose(); }}>Quitar del evento</Button>}
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </FormActions>
        </form>
      )}
    </Modal>
  );
}
