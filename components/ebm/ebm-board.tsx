"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CalendarClock, ChevronDown, Handshake, MessageSquarePlus, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, FormActions, FormGroup, Input, Select, Textarea } from "@/components/ui/form-field";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, OPEN_STATUSES, type BrandLeadItem, type LeadStatus } from "@/lib/ebm-shared";

type Option = { id: string; name: string };
type Props = { initialLeads: BrandLeadItem[]; members: Option[]; clients: Option[]; currentUserId: string };

const TONES: Record<LeadStatus, BadgeTone> = {
  PROSPECT: "neutral",
  CONTACTED: "info",
  IN_TALKS: "info",
  PROPOSAL_SENT: "purple",
  NEGOTIATION: "warning",
  WON: "success",
  LOST: "danger",
  ON_HOLD: "outline",
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "America/New_York" }) : "");
const fmtTime = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const daysFrom = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000) : null);
const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export function EbmBoard({ initialLeads, members, clients, currentUserId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [leads, setLeads] = useState(initialLeads);
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<"OPEN" | "ALL" | LeadStatus>("OPEN");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editLead, setEditLead] = useState<BrandLeadItem | null>(null);
  const [deleteLead, setDeleteLead] = useState<BrandLeadItem | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(payload, "No se pudo completar la acción"));
    return payload.data as T;
  }
  const fail = (err: unknown, title: string) => toast({ title, description: err instanceof Error ? err.message : undefined, variant: "error" });

  async function create(draft: LeadDraft) {
    try {
      const created = await request<BrandLeadItem>("/api/ebm/leads", { method: "POST", body: JSON.stringify(draft) });
      setLeads((prev) => [created, ...prev]);
      router.refresh();
    } catch (err) {
      fail(err, "No se pudo crear el lead");
    }
  }
  async function patch(lead: BrandLeadItem, body: Record<string, unknown>, okTitle?: string) {
    try {
      const updated = await request<BrandLeadItem>(`/api/ebm/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
      if (okTitle) toast({ title: okTitle, variant: "success" });
      router.refresh();
    } catch (err) {
      fail(err, "No se pudo guardar");
    }
  }
  async function addUpdate(lead: BrandLeadItem, text: string) {
    try {
      const updated = await request<BrandLeadItem>(`/api/ebm/leads/${lead.id}/updates`, { method: "POST", body: JSON.stringify({ text }) });
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
      router.refresh();
    } catch (err) {
      fail(err, "No se pudo guardar la actualización");
    }
  }
  async function remove(lead: BrandLeadItem) {
    setDeleteLead(null);
    try {
      await request(`/api/ebm/leads/${lead.id}`, { method: "DELETE" });
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      router.refresh();
    } catch (err) {
      fail(err, "No se pudo eliminar");
    }
  }

  const stats = useMemo(() => {
    const openLeads = leads.filter((l) => OPEN_STATUSES.includes(l.status as LeadStatus));
    const dueSoon = openLeads.filter((l) => {
      const d = daysFrom(l.nextFollowUpAt);
      return d !== null && d <= 0;
    }).length;
    return {
      open: openLeads.length,
      negotiating: leads.filter((l) => l.status === "PROPOSAL_SENT" || l.status === "NEGOTIATION").length,
      won: leads.filter((l) => l.status === "WON").length,
      dueSoon,
    };
  }, [leads]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads
      .filter((l) => (owner ? l.ownerId === owner : true))
      .filter((l) => (status === "ALL" ? true : status === "OPEN" ? OPEN_STATUSES.includes(l.status as LeadStatus) : l.status === status))
      .filter((l) => (needle ? `${l.brand} ${l.client?.name ?? ""} ${l.contactName ?? ""}`.toLowerCase().includes(needle) : true))
      .sort((a, b) => {
        // Overdue follow-ups first, then by next follow-up, then most recently touched.
        const da = daysFrom(a.nextFollowUpAt), dbb = daysFrom(b.nextFollowUpAt);
        if (da !== null && dbb !== null && da !== dbb) return da - dbb;
        if (da !== null && dbb === null) return -1;
        if (da === null && dbb !== null) return 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [leads, owner, status, q]);

  return (
    <>
      <PageHeader
        eyebrow="EB Management"
        title="EBM · Brand deals"
        subtitle="Quién está hablando con qué marca, para qué artista, y en qué va cada lead."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
            Nuevo lead
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 w-auto min-w-[160px] text-sm" aria-label="Vendedor">
            <option value="">Todos los vendedores</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-9 w-auto min-w-[160px] text-sm" aria-label="Estatus">
            <option value="OPEN">Abiertos</option>
            <option value="ALL">Todos</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
          </Select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar marca, artista, contacto…" className="h-9 w-full text-sm sm:w-64" />
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Leads abiertos" value={stats.open} icon={<Briefcase />} />
        <StatTile label="En propuesta / negociación" value={stats.negotiating} icon={<Handshake />} tone="warning" />
        <StatTile label="Cerrados" value={stats.won} icon={<Trophy />} tone="success" />
        <StatTile label="Seguimientos vencidos" value={stats.dueSoon} icon={<CalendarClock />} tone={stats.dueSoon ? "danger" : "neutral"} />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Briefcase />}
          title={leads.length === 0 ? "Todavía no hay leads" : "Nada con esos filtros"}
          description={leads.length === 0 ? "Crea el primero: la marca, para qué artista y quién lo está trabajando." : "Prueba con otro vendedor o estatus."}
          action={leads.length === 0 ? <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>Nuevo lead</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((l) => (
            <LeadCard
              key={l.id}
              lead={l}
              open={!!open[l.id]}
              onToggle={() => setOpen((o) => ({ ...o, [l.id]: !o[l.id] }))}
              onStatus={(s) => void patch(l, { status: s })}
              onEdit={() => setEditLead(l)}
              onDelete={() => setDeleteLead(l)}
              onUpdate={(text) => addUpdate(l, text)}
            />
          ))}
        </div>
      )}

      <LeadModal open={showCreate} onOpenChange={setShowCreate} lead={null} members={members} clients={clients} defaultOwnerId={currentUserId} onSubmit={create} />
      <LeadModal
        open={editLead !== null}
        onOpenChange={(o) => !o && setEditLead(null)}
        lead={editLead}
        members={members}
        clients={clients}
        defaultOwnerId={currentUserId}
        onSubmit={async (draft) => {
          if (editLead) await patch(editLead, draft, "Lead actualizado");
        }}
      />
      <ConfirmModal
        open={deleteLead !== null}
        onOpenChange={(o) => !o && setDeleteLead(null)}
        title="Eliminar lead"
        description={deleteLead ? `${deleteLead.brand}${deleteLead.client ? ` · ${deleteLead.client.name}` : ""}` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => { if (deleteLead) void remove(deleteLead); }}
      />
    </>
  );
}

function LeadCard({ lead, open, onToggle, onStatus, onEdit, onDelete, onUpdate }: {
  lead: BrandLeadItem;
  open: boolean;
  onToggle: () => void;
  onStatus: (s: LeadStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (text: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const days = daysFrom(lead.nextFollowUpAt);
  const overdue = days !== null && days < 0 && OPEN_STATUSES.includes(lead.status as LeadStatus);
  const dueToday = days === 0;
  const s = lead.status as LeadStatus;

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() || saving) return;
    setSaving(true);
    try {
      await onUpdate(note.trim());
      setNote("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="md" className={cn(overdue && "border-red-200 bg-red-50/40")}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink-primary">{lead.brand}</h3>
            {lead.client && <Badge tone="info" size="xs">{lead.client.name}</Badge>}
            <Badge tone="outline" size="xs">{lead.owner.name}</Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary">
            {lead.contactName && <span>Contacto: <span className="text-ink-primary">{lead.contactName}</span>{lead.contactInfo ? ` · ${lead.contactInfo}` : ""}</span>}
            {lead.nextStep && <span>Siguiente: <span className="text-ink-primary">{lead.nextStep}</span></span>}
            {lead.nextFollowUpAt && (
              <span className={cn(overdue && "font-semibold text-red-700", dueToday && "font-semibold text-amber-700")}>
                <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
                {overdue ? `Seguimiento vencido (${fmt(lead.nextFollowUpAt)})` : dueToday ? "Seguimiento hoy" : `Seguimiento ${fmt(lead.nextFollowUpAt)}`}
              </span>
            )}
            <span className="text-ink-muted">Actualizado {fmt(lead.updatedAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Select value={s} onChange={(e) => onStatus(e.target.value as LeadStatus)} className={cn("h-8 w-auto text-xs font-medium")} aria-label="Estatus">
            {LEAD_STATUSES.map((st) => <option key={st} value={st}>{LEAD_STATUS_LABELS[st]}</option>)}
          </Select>
          <Badge tone={TONES[s]} size="xs" dot>{LEAD_STATUS_LABELS[s]}</Badge>
          <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="Eliminar" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={onToggle} aria-expanded={open}>
            Historial ({lead.updates.length}) <ChevronDown className={cn("ml-1 h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </div>

      {lead.notes && <p className="mt-2 whitespace-pre-line text-xs text-ink-muted">{lead.notes}</p>}

      {open && (
        <div className="mt-3 border-t border-border pt-3">
          <form onSubmit={submitNote} className="mb-3 flex items-start gap-2">
            <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="¿Qué pasó? p. ej. Llamé a la marca, piden propuesta para el 15…" className="min-h-[38px] flex-1 text-sm" />
            <Button type="submit" size="sm" variant="secondary" loading={saving} disabled={!note.trim()} leftIcon={<MessageSquarePlus className="h-4 w-4" />}>Anotar</Button>
          </form>
          <ol className="space-y-2">
            {lead.updates.map((u) => (
              <li key={u.id} className="text-xs">
                <span className="text-ink-muted">{fmtTime(u.createdAt)} · {u.author.name}</span>
                {u.status && <Badge tone={TONES[u.status as LeadStatus] ?? "neutral"} size="xs" className="ml-2">{LEAD_STATUS_LABELS[u.status as LeadStatus] ?? u.status}</Badge>}
                <p className="mt-0.5 whitespace-pre-line text-ink-primary">{u.text}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

type LeadDraft = {
  brand: string;
  clientId: string | null;
  ownerId: string;
  status: LeadStatus;
  contactName: string | null;
  contactInfo: string | null;
  nextStep: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
};

function LeadModal({ open, onOpenChange, lead, members, clients, defaultOwnerId, onSubmit }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead: BrandLeadItem | null;
  members: Option[];
  clients: Option[];
  defaultOwnerId: string;
  onSubmit: (draft: LeadDraft) => Promise<void>;
}) {
  const [brand, setBrand] = useState("");
  const [clientId, setClientId] = useState("");
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [status, setStatus] = useState<LeadStatus>("PROSPECT");
  const [contactName, setContactName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setBrand(lead?.brand ?? "");
    setClientId(lead?.clientId ?? "");
    setOwnerId(lead?.ownerId ?? defaultOwnerId);
    setStatus((lead?.status as LeadStatus) ?? "PROSPECT");
    setContactName(lead?.contactName ?? "");
    setContactInfo(lead?.contactInfo ?? "");
    setNextStep(lead?.nextStep ?? "");
    setNextFollowUpAt(lead?.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 10) : "");
    setNotes(lead?.notes ?? "");
    setSaving(false);
  } else if (!open && wasOpen) setWasOpen(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!brand.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        brand: brand.trim(),
        clientId: clientId || null,
        ownerId,
        status,
        contactName: contactName.trim() || null,
        contactInfo: contactInfo.trim() || null,
        nextStep: nextStep.trim() || null,
        nextFollowUpAt: nextFollowUpAt || null,
        notes: notes.trim() || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={lead ? "Editar lead" : "Nuevo lead"} description={lead ? undefined : "La marca con la que estamos hablando, para qué artista y quién lo lleva."} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormGroup label="Marca" htmlFor="lead-brand" required>
            <Input id="lead-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="p. ej. Adidas" autoFocus required />
          </FormGroup>
          <FormGroup label="Artista" htmlFor="lead-client">
            <Select id="lead-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Por definir</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Vendedor" htmlFor="lead-owner">
            <Select id="lead-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Estatus" htmlFor="lead-status">
            <Select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Contacto en la marca" htmlFor="lead-contact">
            <Input id="lead-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nombre y cargo" />
          </FormGroup>
          <FormGroup label="Email / IG / teléfono" htmlFor="lead-contact-info">
            <Input id="lead-contact-info" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
          </FormGroup>
          <FormGroup label="Siguiente paso" htmlFor="lead-next">
            <Input id="lead-next" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="p. ej. Enviar propuesta" />
          </FormGroup>
          <FormGroup label="Fecha de seguimiento" htmlFor="lead-followup">
            <Input id="lead-followup" type="date" value={nextFollowUpAt} min={lead ? undefined : todayKey()} onChange={(e) => setNextFollowUpAt(e.target.value)} />
          </FormGroup>
        </div>
        <FormGroup label="Notas" htmlFor="lead-notes">
          <Textarea id="lead-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexto del deal, qué busca la marca, condiciones…" />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="submit" loading={saving} disabled={!brand.trim()}>{lead ? "Guardar" : "Crear lead"}</Button>
        </FormActions>
      </form>
    </Modal>
  );
}
