"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CalendarClock, Handshake, History, MessageSquarePlus, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
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

const STATUS_DOT: Partial<Record<BadgeTone, string>> = { neutral: "bg-ink-muted", info: "bg-blue-500", purple: "bg-purple-500", warning: "bg-amber-500", success: "bg-green-600", danger: "bg-red-600", outline: "bg-ink-muted/50" };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "");
const fmtTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
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
  const [historyLead, setHistoryLead] = useState<BrandLeadItem | null>(null);

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(payload, "Could not complete the action"));
    return payload.data as T;
  }
  const fail = (err: unknown, title: string) => toast({ title, description: err instanceof Error ? err.message : undefined, variant: "error" });

  async function create(draft: LeadDraft) {
    try {
      const created = await request<BrandLeadItem>("/api/ebm/leads", { method: "POST", body: JSON.stringify(draft) });
      setLeads((prev) => [created, ...prev]);
      router.refresh();
    } catch (err) {
      fail(err, "Could not create the lead");
    }
  }
  async function patch(lead: BrandLeadItem, body: Record<string, unknown>, okTitle?: string) {
    try {
      const updated = await request<BrandLeadItem>(`/api/ebm/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
      if (okTitle) toast({ title: okTitle, variant: "success" });
      router.refresh();
    } catch (err) {
      fail(err, "Could not save");
    }
  }
  async function addUpdate(lead: BrandLeadItem, text: string) {
    try {
      const updated = await request<BrandLeadItem>(`/api/ebm/leads/${lead.id}/updates`, { method: "POST", body: JSON.stringify({ text }) });
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
      router.refresh();
    } catch (err) {
      fail(err, "Could not save the update");
    }
  }
  async function remove(lead: BrandLeadItem) {
    setDeleteLead(null);
    try {
      await request(`/api/ebm/leads/${lead.id}`, { method: "DELETE" });
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      router.refresh();
    } catch (err) {
      fail(err, "Could not delete");
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

  const bySeller = useMemo(() => {
    const groups = new Map<string, { owner: { id: string; name: string }; leads: BrandLeadItem[] }>();
    for (const l of visible) {
      const g = groups.get(l.ownerId) ?? { owner: l.owner, leads: [] };
      g.leads.push(l);
      groups.set(l.ownerId, g);
    }
    return [...groups.values()].sort((a, b) => a.owner.name.localeCompare(b.owner.name, "en"));
  }, [visible]);

  return (
    <>
      <PageHeader
        eyebrow="EB Management"
        title="EBM · Brand Deals"
        subtitle="Who is talking to which brand, for which artist, and where each lead stands."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
            New lead
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 w-auto min-w-[160px] text-sm" aria-label="Seller">
            <option value="">All sellers</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-9 w-auto min-w-[160px] text-sm" aria-label="Status">
            <option value="OPEN">Open</option>
            <option value="ALL">All</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
          </Select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand, artist, contact…" className="h-9 w-full text-sm sm:w-64" />
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open leads" value={stats.open} icon={<Briefcase />} />
        <StatTile label="Proposal / negotiating" value={stats.negotiating} icon={<Handshake />} tone="warning" />
        <StatTile label="Closed" value={stats.won} icon={<Trophy />} tone="success" />
        <StatTile label="Overdue follow-ups" value={stats.dueSoon} icon={<CalendarClock />} tone={stats.dueSoon ? "danger" : "neutral"} />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Briefcase />}
          title={leads.length === 0 ? "No leads yet" : "Nothing matches those filters"}
          description={leads.length === 0 ? "Create the first one: the brand, which artist it is for, and who is working it." : "Try another seller or status."}
          action={leads.length === 0 ? <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>New lead</Button> : undefined}
        />
      ) : (
        <div className="space-y-6">
          {bySeller.map((g) => (
            <section key={g.owner.id}>
              <div className="mb-2 flex items-baseline gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-primary">Seller: {g.owner.name}</h2>
                <span className="text-xs text-ink-muted">{g.leads.length} {g.leads.length === 1 ? "lead" : "leads"}</span>
              </div>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Lead / Brand</Th>
                      <Th>Artist</Th>
                      <Th>Contact</Th>
                      <Th>Next step</Th>
                      <Th>Notes</Th>
                      <Th>Status</Th>
                      <Th className="w-28" />
                    </tr>
                  </thead>
                  <tbody>
                    {g.leads.map((l) => (
                      <LeadRow
                        key={l.id}
                        lead={l}
                        onStatus={(st) => void patch(l, { status: st })}
                        onEdit={() => setEditLead(l)}
                        onDelete={() => setDeleteLead(l)}
                        onHistory={() => setHistoryLead(l)}
                      />
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </section>
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
          if (editLead) await patch(editLead, draft, "Lead updated");
        }}
      />
      <HistoryModal
        lead={historyLead ? leads.find((l) => l.id === historyLead.id) ?? null : null}
        onClose={() => setHistoryLead(null)}
        onUpdate={(lead, text) => addUpdate(lead, text)}
      />
      <ConfirmModal
        open={deleteLead !== null}
        onOpenChange={(o) => !o && setDeleteLead(null)}
        title="Delete lead"
        description={deleteLead ? `${deleteLead.brand}${deleteLead.client ? ` · ${deleteLead.client.name}` : ""}` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (deleteLead) void remove(deleteLead); }}
      />
    </>
  );
}

function LeadRow({ lead, onStatus, onEdit, onDelete, onHistory }: {
  lead: BrandLeadItem;
  onStatus: (s: LeadStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onHistory: () => void;
}) {
  const days = daysFrom(lead.nextFollowUpAt);
  const isOpen = OPEN_STATUSES.includes(lead.status as LeadStatus);
  const overdue = isOpen && days !== null && days < 0;
  const dueToday = isOpen && days === 0;
  const s = lead.status as LeadStatus;
  const lastNote = lead.updates.find((u) => !/^Moved to |^Pasó a |^Lead created$|^Lead creado$/.test(u.text));
  return (
    <tr className={cn(overdue && "bg-red-50/60")}>
      <Td>
        <div className="font-semibold text-ink-primary">{lead.brand}</div>
        <div className="text-2xs text-ink-muted">Updated {fmt(lead.updatedAt)}</div>
      </Td>
      <Td>{lead.client ? lead.client.name : <span className="text-ink-muted">TBD</span>}</Td>
      <Td>
        {lead.contactName ? <div>{lead.contactName}</div> : <span className="text-ink-muted">—</span>}
        {lead.contactInfo && <div className="text-2xs text-ink-muted">{lead.contactInfo}</div>}
      </Td>
      <Td>
        {lead.nextStep ? <div>{lead.nextStep}</div> : <span className="text-ink-muted">—</span>}
        {lead.nextFollowUpAt && (
          <div className={cn("text-2xs", overdue ? "font-semibold text-red-700" : dueToday ? "font-semibold text-amber-700" : "text-ink-muted")}>
            <CalendarClock className="mr-1 inline h-3 w-3" />
            {overdue ? `Overdue · ${fmt(lead.nextFollowUpAt)}` : dueToday ? "Today" : fmt(lead.nextFollowUpAt)}
          </div>
        )}
      </Td>
      <Td className="max-w-[260px]">
        {lastNote ? (
          <div className="line-clamp-2 text-xs text-ink-secondary" title={lastNote.text}>{lastNote.text}</div>
        ) : lead.notes ? (
          <div className="line-clamp-2 text-xs text-ink-secondary" title={lead.notes}>{lead.notes}</div>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </Td>
      <Td>
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[TONES[s]] ?? "bg-ink-muted")} aria-hidden />
          <Select value={s} onChange={(e) => onStatus(e.target.value as LeadStatus)} className="h-7 w-auto text-xs font-medium" aria-label="Change status">
            {LEAD_STATUSES.map((st) => <option key={st} value={st}>{LEAD_STATUS_LABELS[st]}</option>)}
          </Select>
        </div>
      </Td>
      <Td>
        <div className="flex items-center justify-end gap-0.5">
          <Button size="icon-sm" variant="ghost" aria-label="History and notes" title={`History (${lead.updates.length})`} onClick={onHistory}><History className="h-4 w-4" /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </Td>
    </tr>
  );
}

function HistoryModal({ lead, onClose, onUpdate }: { lead: BrandLeadItem | null; onClose: () => void; onUpdate: (lead: BrandLeadItem, text: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !note.trim() || saving) return;
    setSaving(true);
    try {
      await onUpdate(lead, note.trim());
      setNote("");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={lead !== null} onOpenChange={(o) => !o && onClose()} title={lead ? `${lead.brand}${lead.client ? ` · ${lead.client.name}` : ""}` : ""} description={lead ? `Seller: ${lead.owner.name}${lead.notes ? ` · ${lead.notes}` : ""}` : undefined} size="lg">
      {lead && (
        <div>
          <form onSubmit={submit} className="mb-4 flex items-start gap-2">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? e.g. Called the brand, they want a proposal by the 15th…" className="flex-1 text-sm" autoFocus />
            <Button type="submit" size="sm" variant="secondary" loading={saving} disabled={!note.trim()} leftIcon={<MessageSquarePlus className="h-4 w-4" />}>Add note</Button>
          </form>
          <ol className="max-h-80 space-y-3 overflow-y-auto">
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
    </Modal>
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
    <Modal open={open} onOpenChange={onOpenChange} title={lead ? "Edit lead" : "New lead"} description={lead ? undefined : "The brand we are talking to, which artist it is for, and who owns it."} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormGroup label="Brand" htmlFor="lead-brand" required>
            <Input id="lead-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Adidas" autoFocus required />
          </FormGroup>
          <FormGroup label="Artist" htmlFor="lead-client">
            <Select id="lead-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">TBD</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Seller" htmlFor="lead-owner">
            <Select id="lead-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Status" htmlFor="lead-status">
            <Select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Contact at the brand" htmlFor="lead-contact">
            <Input id="lead-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name and title" />
          </FormGroup>
          <FormGroup label="Email / IG / phone" htmlFor="lead-contact-info">
            <Input id="lead-contact-info" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
          </FormGroup>
          <FormGroup label="Next step" htmlFor="lead-next">
            <Input id="lead-next" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="e.g. Send proposal" />
          </FormGroup>
          <FormGroup label="Follow-up date" htmlFor="lead-followup">
            <Input id="lead-followup" type="date" value={nextFollowUpAt} min={lead ? undefined : todayKey()} onChange={(e) => setNextFollowUpAt(e.target.value)} />
          </FormGroup>
        </div>
        <FormGroup label="Notes" htmlFor="lead-notes">
          <Textarea id="lead-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Deal context, what the brand is looking for, terms…" />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!brand.trim()}>{lead ? "Save" : "Create lead"}</Button>
        </FormActions>
      </form>
    </Modal>
  );
}
