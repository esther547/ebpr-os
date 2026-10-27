"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Plus, Search, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, FormActions, FormGroup, Input, Select, Textarea } from "@/components/ui/form-field";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { shortName } from "@/lib/short-name";
import { OVERLAP_DAYS, PITCH_STATUSES, PITCH_STATUS_LABELS, PITCH_STATUS_TONES, type Overlap, type PitchRow, type PitchStatus } from "@/lib/press-pitches-shared";

type Option = { id: string; name: string };
type Props = { initialPitches: PitchRow[]; clients: Option[]; publicists: Option[]; currentUserId: string; isAdmin: boolean };
type JournalistHit = { id: string; name: string; outlet: string | null; email: string };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
async function readError(res: Response, fallback: string) { try { const d = await res.json(); return apiErrorMessage(d, fallback); } catch { return fallback; } }

export function PitchesBoard({ initialPitches, clients, publicists, currentUserId, isAdmin }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pitches, setPitches] = useState(initialPitches);
  useEffect(() => setPitches(initialPitches), [initialPitches]);
  const [q, setQ] = useState("");
  const [who, setWho] = useState("");
  const [clientF, setClientF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<PitchRow | null>(null);
  const [removing, setRemoving] = useState<PitchRow | null>(null);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pitches.filter((p) => (!who || p.pitchedBy.id === who) && (!clientF || p.client.id === clientF) && (!statusF || p.status === statusF)
      && (!s || [p.contactName, p.outlet, p.client.name, p.pitchedBy.name, p.subject, p.notes].some((v) => v?.toLowerCase().includes(s))));
  }, [pitches, q, who, clientF, statusF]);

  const since = Date.now() - OVERLAP_DAYS * 86_400_000;
  const recent = pitches.filter((p) => new Date(p.pitchedAt).getTime() >= since);
  const open = pitches.filter((p) => ["PITCHED", "FOLLOW_UP", "REPLIED"].includes(p.status));
  const dueFollowUps = pitches.filter((p) => p.followUpAt && new Date(p.followUpAt).getTime() <= Date.now() && ["PITCHED", "FOLLOW_UP", "REPLIED"].includes(p.status));
  // Same contact pitched by two different publicists within the window: the thing this tab exists to prevent.
  const crossed = useMemo(() => { const by = new Map<string, Set<string>>(); for (const p of recent) { const k = (p.journalistId ?? p.contactName.toLowerCase().trim()); by.set(k, (by.get(k) ?? new Set()).add(p.pitchedBy.id)); } return [...by.values()].filter((s) => s.size > 1).length; }, [recent]);

  async function patch(p: PitchRow, body: Record<string, unknown>) {
    const res = await fetch(`/api/press-pitches/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!res || !res.ok) { toast({ title: "No se pudo guardar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return; }
    const data = await res.json(); setPitches((prev) => prev.map((x) => (x.id === p.id ? data.data : x))); router.refresh();
  }
  async function remove(p: PitchRow) {
    const res = await fetch(`/api/press-pitches/${p.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) { toast({ title: "No se pudo borrar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return false; }
    setPitches((prev) => prev.filter((x) => x.id !== p.id)); router.refresh(); return true;
  }

  return (
    <>
      <PageHeader eyebrow="Prensa" title="Pitches de prensa" subtitle="Prensa · Cliente · Publicista. Antes de pitchear, busca al contacto aquí: si alguien del equipo ya le escribió, lo ves al instante."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>Registrar pitch</Button>}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Periodista, medio, cliente, tema…" className="h-9 pl-9 text-sm" /></div>
          <Select value={who} onChange={(e) => setWho(e.target.value)} className="h-9 w-auto text-sm" aria-label="Publicista"><option value="">Todos los publicistas</option>{publicists.map((m) => <option key={m.id} value={m.id}>{shortName(m.name, publicists)}</option>)}</Select>
          <Select value={clientF} onChange={(e) => setClientF(e.target.value)} className="h-9 w-auto text-sm" aria-label="Cliente"><option value="">Todos los clientes</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="h-9 w-auto text-sm" aria-label="Estado"><option value="">Todos los estados</option>{PITCH_STATUSES.map((s) => <option key={s} value={s}>{PITCH_STATUS_LABELS[s]}</option>)}</Select>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={`Pitches (últimos ${OVERLAP_DAYS} días)`} value={recent.length} icon={<Send className="h-4 w-4" />} />
        <StatTile label="Abiertos" value={open.length} hint="pitcheados, en seguimiento o con respuesta" />
        <StatTile label="Seguimientos vencidos" value={dueFollowUps.length} tone={dueFollowUps.length ? "warning" : "neutral"} />
        <StatTile label="Contactos cruzados" value={crossed} hint={crossed ? "dos publicistas al mismo contacto" : "nadie se cruzó"} tone={crossed ? "danger" : "success"} icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<Send />} title={pitches.length === 0 ? "Todavía no hay pitches registrados" : "Nada coincide con los filtros"} description="Registra cada pitch con el contacto de prensa, el cliente y quién lo hizo." action={<Button onClick={() => setShowCreate(true)}>Registrar pitch</Button>} />
      ) : (
        <TableWrap>
          <Table>
            <thead><tr><Th>Prensa</Th><Th>Cliente</Th><Th>Publicista</Th><Th>Fecha</Th><Th>Estado</Th><Th>Tema / notas</Th><Th>Seguimiento</Th><Th></Th></tr></thead>
            <tbody>
              {visible.map((p) => {
                const others = recent.filter((o) => o.id !== p.id && o.pitchedBy.id !== p.pitchedBy.id && ((p.journalistId && o.journalistId === p.journalistId) || o.contactName.toLowerCase().trim() === p.contactName.toLowerCase().trim()));
                const due = p.followUpAt && new Date(p.followUpAt).getTime() <= Date.now() && ["PITCHED", "FOLLOW_UP", "REPLIED"].includes(p.status);
                return (
                  <tr key={p.id} className="align-top">
                    <Td><div className="font-medium">{p.contactName}</div>{p.outlet && <div className="text-xs text-ink-muted">{p.outlet}</div>}{others.length > 0 && <div className="mt-1 text-[11px] text-red-700">⚠ también {others.map((o) => `${shortName(o.pitchedBy.name, publicists)} (${o.client.name}, ${fmt(o.pitchedAt)})`).join(", ")}</div>}</Td>
                    <Td className="text-sm">{p.client.name}</Td>
                    <Td className="text-sm">{shortName(p.pitchedBy.name, publicists)}</Td>
                    <Td className="text-xs">{fmt(p.pitchedAt)}</Td>
                    <Td><Select value={p.status} onChange={(e) => patch(p, { status: e.target.value })} className="h-8 w-auto text-xs">{PITCH_STATUSES.map((s) => <option key={s} value={s}>{PITCH_STATUS_LABELS[s]}</option>)}</Select></Td>
                    <Td className="max-w-[260px] text-xs text-ink-secondary">{p.subject && <div className="font-medium text-ink-primary">{p.subject}</div>}{p.notes && <div className="line-clamp-2" title={p.notes}>{p.notes}</div>}</Td>
                    <Td className={`text-xs ${due ? "font-semibold text-amber-700" : ""}`}>{fmt(p.followUpAt) || <span className="text-ink-muted">—</span>}</Td>
                    <Td><div className="flex gap-0.5">
                      <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                      {(isAdmin || p.pitchedBy.id === currentUserId) && <Button size="icon-sm" variant="ghost" aria-label="Borrar" onClick={() => setRemoving(p)}><Trash2 className="h-4 w-4" /></Button>}
                    </div></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <PitchModal open={showCreate || !!editing} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditing(null); } }} pitch={editing} clients={clients} publicists={publicists} currentUserId={currentUserId}
        onSaved={(row, isNew) => { setPitches((prev) => (isNew ? [row, ...prev] : prev.map((x) => (x.id === row.id ? row : x)))); setShowCreate(false); setEditing(null); router.refresh(); }} />
      <ConfirmModal open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title="Borrar pitch" description={removing ? `Se borra el pitch a ${removing.contactName} para ${removing.client.name}.` : ""} confirmLabel="Borrar" destructive onConfirm={async () => { if (removing && (await remove(removing))) setRemoving(null); }} />
    </>
  );
}

function PitchModal({ open, onOpenChange, pitch, clients, publicists, currentUserId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; pitch: PitchRow | null; clients: Option[]; publicists: Option[]; currentUserId: string; onSaved: (row: PitchRow, isNew: boolean) => void }) {
  const { toast } = useToast();
  const isEdit = !!pitch;
  const [contactName, setContactName] = useState("");
  const [outlet, setOutlet] = useState("");
  const [journalistId, setJournalistId] = useState<string | null>(null);
  const [hits, setHits] = useState<JournalistHit[]>([]);
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);
  const [saving, setSaving] = useState(false);
  const [forceSave, setForceSave] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setContactName(pitch?.contactName ?? ""); setOutlet(pitch?.outlet ?? ""); setJournalistId(pitch?.journalistId ?? null); setHits([]); setOverlaps([]); setForceSave(false);
  }, [open, pitch]);

  // Medios lookup + "did anyone already pitch them?" as you type.
  useEffect(() => {
    if (!open || isEdit) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const term = contactName.trim();
    if (term.length < 2) { setHits([]); setOverlaps([]); return; }
    searchTimer.current = setTimeout(async () => {
      const [j, o] = await Promise.all([
        fetch(`/api/journalists?search=${encodeURIComponent(term)}&limit=6`).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
        fetch(`/api/press-pitches?contact=${encodeURIComponent(term)}${journalistId ? `&journalistId=${journalistId}` : ""}`).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      ]);
      setHits((j.data ?? []).map((x: JournalistHit) => ({ id: x.id, name: x.name, outlet: x.outlet, email: x.email })));
      setOverlaps(o.data ?? []);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [contactName, journalistId, open, isEdit]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget); const g = (k: string) => ((fd.get(k) as string | null) ?? "").trim() || null;
    const body = { journalistId, contactName: contactName.trim(), outlet: outlet.trim() || null, clientId: g("clientId") ?? "", pitchedById: g("pitchedById") ?? currentUserId, pitchedAt: g("pitchedAt") ?? today(), status: g("status") ?? "PITCHED", subject: g("subject"), notes: g("notes"), followUpAt: g("followUpAt"), force: forceSave };
    setSaving(true);
    const res = await fetch(isEdit ? `/api/press-pitches/${pitch!.id}` : "/api/press-pitches", { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setSaving(false);
    if (res && res.status === 409) { const d = await res.json(); setOverlaps(d.overlaps ?? []); setForceSave(true); toast({ title: "Ojo: alguien ya le pitcheó", description: "Revisa el aviso y, si aun así va, vuelve a guardar.", variant: "error" }); return; }
    if (!res || !res.ok) { toast({ title: "No se pudo guardar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return; }
    const data = await res.json();
    toast({ title: isEdit ? "Pitch actualizado" : "Pitch registrado", variant: "success" }); onSaved(data.data, !isEdit);
  }
  const recentOverlaps = overlaps.filter((o) => new Date(o.pitchedAt).getTime() >= Date.now() - OVERLAP_DAYS * 86_400_000 && o.id !== pitch?.id);
  const olderOverlaps = overlaps.filter((o) => !recentOverlaps.includes(o) && o.id !== pitch?.id);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={isEdit ? "Editar pitch" : "Registrar pitch"} description={isEdit ? `${pitch!.contactName} · ${pitch!.client.name}` : "Escribe el nombre del periodista: si está en Medios lo tomamos de ahí, y si alguien ya le pitcheó te avisamos antes de guardar."} size="lg">
      <form key={pitch?.id ?? "new"} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Periodista / contacto" htmlFor="pp-contact" required>
            <div className="relative">
              <Input id="pp-contact" value={contactName} onChange={(e) => { setContactName(e.target.value); setJournalistId(null); setForceSave(false); }} required autoFocus autoComplete="off" placeholder="Jessica Roiz" />
              {!isEdit && hits.length > 0 && !journalistId && (
                <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-white shadow-pop">
                  {hits.map((h) => (
                    <li key={h.id}><button type="button" className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-surface-muted" onClick={() => { setContactName(h.name); setOutlet(h.outlet ?? ""); setJournalistId(h.id); setHits([]); }}><span className="font-medium">{h.name}</span><span className="text-xs text-ink-muted">{[h.outlet, h.email].filter(Boolean).join(" · ")}</span></button></li>
                  ))}
                </ul>
              )}
            </div>
            {journalistId && <p className="mt-1 text-[11px] text-green-700">Vinculado a la base de Medios.</p>}
          </FormGroup>
          <FormGroup label="Medio" htmlFor="pp-outlet"><Input id="pp-outlet" value={outlet} onChange={(e) => setOutlet(e.target.value)} placeholder="Billboard" /></FormGroup>
          <FormGroup label="Cliente" htmlFor="pp-client" required><Select id="pp-client" name="clientId" defaultValue={pitch?.client.id ?? ""} required><option value="">Elige…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></FormGroup>
          <FormGroup label="Publicista" htmlFor="pp-by"><Select id="pp-by" name="pitchedById" defaultValue={pitch?.pitchedBy.id ?? currentUserId}>{publicists.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></FormGroup>
          <FormGroup label="Fecha del pitch" htmlFor="pp-date"><Input id="pp-date" name="pitchedAt" type="date" defaultValue={pitch ? pitch.pitchedAt.slice(0, 10) : today()} /></FormGroup>
          <FormGroup label="Estado" htmlFor="pp-status"><Select id="pp-status" name="status" defaultValue={pitch?.status ?? "PITCHED"}>{PITCH_STATUSES.map((s) => <option key={s} value={s}>{PITCH_STATUS_LABELS[s]}</option>)}</Select></FormGroup>
          <FormGroup label="Tema / ángulo" htmlFor="pp-subject" className="sm:col-span-2"><Input id="pp-subject" name="subject" defaultValue={pitch?.subject ?? ""} placeholder="Entrevista por lanzamiento del sencillo" /></FormGroup>
          <FormGroup label="Seguimiento" htmlFor="pp-fu" hint="cuándo volver a escribir"><Input id="pp-fu" name="followUpAt" type="date" defaultValue={pitch?.followUpAt ? pitch.followUpAt.slice(0, 10) : ""} /></FormGroup>
        </div>
        <FormGroup label="Notas" htmlFor="pp-notes"><Textarea id="pp-notes" name="notes" rows={3} defaultValue={pitch?.notes ?? ""} /></FormGroup>
        {recentOverlaps.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <p className="font-semibold">⚠ Ya le pitchearon en los últimos {OVERLAP_DAYS} días:</p>
            <ul className="mt-1 list-disc pl-5 text-xs">{recentOverlaps.map((o) => <li key={o.id}><strong>{o.pitchedBy}</strong> para {o.client} el {fmt(o.pitchedAt)} · <Badge tone={PITCH_STATUS_TONES[o.status as PitchStatus] ?? "neutral"}>{PITCH_STATUS_LABELS[o.status as PitchStatus] ?? o.status}</Badge></li>)}</ul>
            {forceSave && <p className="mt-1 text-xs">Si aun así va (por ejemplo, ya lo hablaste con quien le escribió), vuelve a pulsar Registrar.</p>}
          </div>
        )}
        {olderOverlaps.length > 0 && <p className="text-xs text-ink-muted">Pitches anteriores a este contacto: {olderOverlaps.slice(0, 4).map((o) => `${o.pitchedBy} · ${o.client} · ${fmt(o.pitchedAt)}`).join(" | ")}</p>}
        <FormActions><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando…" : isEdit ? "Guardar" : forceSave ? "Registrar de todos modos" : "Registrar"}</Button></FormActions>
      </form>
    </Modal>
  );
}
