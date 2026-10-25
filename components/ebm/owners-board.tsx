"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, History, Lock, MessageSquarePlus, Pencil, Plus, Trash2, Users } from "lucide-react";
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
import { CATEGORY_LABELS, ITEM_CATEGORIES, ITEM_STATUSES, OPEN_ITEM_STATUSES, STATUS_LABELS, type ItemCategory, type ItemStatus, type OwnerItemRow, type TeamLeadSummary } from "@/lib/ebm-owners-shared";

type Option = { id: string; name: string };
type Props = { initialItems: OwnerItemRow[]; team: TeamLeadSummary[]; members: Option[]; leads: { id: string; label: string }[]; currentUserId: string };

const TONES: Record<ItemStatus, BadgeTone> = { OPEN: "neutral", IN_PROGRESS: "info", WAITING_LEGAL: "purple", WAITING_BRAND: "warning", WAITING_TALENT: "warning", WAITING_TEAM: "warning", DONE: "success" };
const CAT_TONES: Record<ItemCategory, BadgeTone> = { TEAM: "info", CAMPAIGN: "purple", LEGAL: "dark", LEAD: "warning", OTHER: "outline" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "");
const fmtTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const ago = (iso: string | null) => { if (!iso) return "—"; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`; };

export function OwnersBoard({ initialItems, team, members, leads, currentUserId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [view, setView] = useState<"OPEN" | "WEEKLY" | "ALL">("OPEN");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<OwnerItemRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<OwnerItemRow | null>(null);
  const [historyItem, setHistoryItem] = useState<OwnerItemRow | null>(null);

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(payload, "Could not complete the action"));
    return payload.data as T;
  }
  const fail = (err: unknown, title: string) => toast({ title, description: err instanceof Error ? err.message : undefined, variant: "error" });
  const replace = (updated: OwnerItemRow) => { setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i))); setHistoryItem((h) => (h && h.id === updated.id ? updated : h)); };

  async function create(draft: Draft) {
    try { const created = await request<OwnerItemRow>("/api/ebm/owners", { method: "POST", body: JSON.stringify(draft) }); setItems((p) => [created, ...p]); router.refresh(); } catch (err) { fail(err, "Could not create the item"); }
  }
  async function patch(item: OwnerItemRow, body: Record<string, unknown>, okTitle?: string) {
    try { replace(await request<OwnerItemRow>(`/api/ebm/owners/${item.id}`, { method: "PATCH", body: JSON.stringify(body) })); if (okTitle) toast({ title: okTitle, variant: "success" }); router.refresh(); } catch (err) { fail(err, "Could not save"); }
  }
  async function addNote(item: OwnerItemRow, text: string, discussed = false) {
    try { replace(await request<OwnerItemRow>(`/api/ebm/owners/${item.id}/updates`, { method: "POST", body: JSON.stringify({ text, discussed }) })); router.refresh(); } catch (err) { fail(err, "Could not add the note"); }
  }
  async function remove(item: OwnerItemRow) {
    try { await request(`/api/ebm/owners/${item.id}`, { method: "DELETE" }); setItems((p) => p.filter((i) => i.id !== item.id)); setDeleteItem(null); router.refresh(); } catch (err) { fail(err, "Could not delete"); }
  }

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => (view === "ALL" || (view === "WEEKLY" ? i.forWeekly : (OPEN_ITEM_STATUSES as string[]).includes(i.status)))
      && (!category || i.category === category)
      && (!s || [i.title, i.notes, i.nextStep, i.waitingOn, i.handler?.name, i.lead?.brand].some((v) => v?.toLowerCase().includes(s))));
  }, [items, view, category, q]);

  const open = items.filter((i) => (OPEN_ITEM_STATUSES as string[]).includes(i.status));
  const waiting = open.filter((i) => i.status.startsWith("WAITING"));
  const weekly = items.filter((i) => i.forWeekly);
  const overdue = open.filter((i) => i.dueAt && new Date(i.dueAt).getTime() < Date.now() - 86_400_000);

  return (
    <>
      <PageHeader eyebrow="EB Management · private" title="Esther & Benjy" subtitle="Only the two of you see this. Team leads, open conversations, what is stuck with legal or a brand, and the topics for the weekly."
        actions={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>New item</Button>}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5 text-sm">
            {([["OPEN", "Open"], ["WEEKLY", `For the weekly${weekly.length ? ` (${weekly.length})` : ""}`], ["ALL", "All"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setView(k)} className={`rounded-md px-3 py-1.5 ${view === k ? "bg-ink-primary text-white" : "text-ink-secondary hover:bg-surface-muted"}`}>{label}</button>
            ))}
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-auto min-w-[150px] text-sm" aria-label="Category"><option value="">All categories</option>{ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</Select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-full text-sm sm:w-56" />
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open items" value={open.length} icon={<Lock className="h-4 w-4" />} />
        <StatTile label="Waiting on someone" value={waiting.length} hint={waiting.filter((i) => i.status === "WAITING_LEGAL").length ? `${waiting.filter((i) => i.status === "WAITING_LEGAL").length} with legal` : undefined} icon={<CalendarClock className="h-4 w-4" />} tone={waiting.length ? "warning" : "neutral"} />
        <StatTile label="For the weekly" value={weekly.length} icon={<Users className="h-4 w-4" />} tone={weekly.length ? "success" : "neutral"} />
        <StatTile label="Past due" value={overdue.length} icon={<AlertTriangle className="h-4 w-4" />} tone={overdue.length ? "danger" : "neutral"} />
      </div>

      {view === "WEEKLY" ? (
        <WeeklyAgenda items={visible} onDiscussed={(i) => addNote(i, "Discussed in the weekly", true)} onOpen={setHistoryItem} onEdit={setEditItem} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Lock />} title={items.length === 0 ? "Nothing tracked yet" : "Nothing matches"} description="Add a lead to watch, a conversation in progress, something waiting on legal, or a topic for the weekly." action={<Button onClick={() => setShowCreate(true)}>New item</Button>} />
      ) : (
        <TableWrap>
          <Table>
            <thead><tr><Th>Item</Th><Th>Status</Th><Th>Waiting on / next step</Th><Th>Handling</Th><Th>Due</Th><Th>Last note</Th><Th></Th></tr></thead>
            <tbody>
              {visible.map((i) => {
                const last = i.updates[0]; const late = i.dueAt && new Date(i.dueAt).getTime() < Date.now() - 86_400_000 && i.status !== "DONE";
                return (
                  <tr key={i.id} className="align-top">
                    <Td>
                      <div className="flex items-center gap-2"><span className="font-medium">{i.title}</span>{i.forWeekly && <Badge tone="info">Weekly</Badge>}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted"><Badge tone={CAT_TONES[i.category as ItemCategory] ?? "outline"}>{CATEGORY_LABELS[i.category as ItemCategory] ?? i.category}</Badge>{i.lead && <span>{i.lead.brand} · {i.lead.owner.name}</span>}</div>
                      {i.notes && <div className="mt-1 max-w-sm text-xs text-ink-secondary line-clamp-2" title={i.notes}>{i.notes}</div>}
                    </Td>
                    <Td><Select value={i.status} onChange={(e) => patch(i, { status: e.target.value })} className="h-8 w-auto text-xs">{ITEM_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</Select></Td>
                    <Td className="max-w-[260px] text-xs">{i.waitingOn && <div className="text-amber-800">⏳ {i.waitingOn}</div>}{i.nextStep && <div className="text-ink-secondary">{i.nextStep}</div>}{!i.waitingOn && !i.nextStep && <span className="text-ink-muted">—</span>}</Td>
                    <Td className="text-sm">{i.handler?.name ?? <span className="text-ink-muted">—</span>}</Td>
                    <Td className={`text-xs ${late ? "font-semibold text-red-600" : ""}`}>{fmt(i.dueAt) || <span className="text-ink-muted">—</span>}</Td>
                    <Td className="max-w-[240px] text-xs text-ink-secondary">{last ? <><div className="line-clamp-2" title={last.text}>{last.text}</div><div className="text-[10px] text-ink-muted">{last.author.name} · {fmtTime(last.createdAt)}</div></> : <span className="text-ink-muted">{ago(i.updatedAt)}</span>}</Td>
                    <Td><div className="flex gap-0.5">
                      <Button size="icon-sm" variant="ghost" aria-label="Weekly" title={i.forWeekly ? "Remove from the weekly" : "Bring to the weekly"} onClick={() => patch(i, { forWeekly: !i.forWeekly })}><Users className={`h-4 w-4 ${i.forWeekly ? "text-blue-600" : ""}`} /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Notes" title={`Notes (${i.updates.length})`} onClick={() => setHistoryItem(i)}><History className="h-4 w-4" /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEditItem(i)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => setDeleteItem(i)}><Trash2 className="h-4 w-4" /></Button>
                    </div></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <Card className="mt-8">
        <h2 className="text-base font-semibold">Team leads at a glance</h2>
        <p className="mb-3 text-xs text-ink-muted">From the Brand Deals board. Stale = no note in 14 days. Overdue = follow-up date already passed.</p>
        {team.length === 0 ? <p className="text-sm text-ink-muted">No leads on the board yet.</p> : (
          <TableWrap><Table>
            <thead><tr><Th>Seller</Th><Th align="right">Open</Th><Th align="right">Overdue</Th><Th align="right">Stale</Th><Th align="right">Closed</Th><Th>Last activity</Th></tr></thead>
            <tbody>{team.map((t) => (
              <tr key={t.ownerId}><Td className="font-medium">{t.ownerName}</Td><Td align="right" numeric>{t.open}</Td><Td align="right" numeric className={t.overdue ? "font-semibold text-red-600" : ""}>{t.overdue}</Td><Td align="right" numeric className={t.stale ? "font-semibold text-amber-700" : ""}>{t.stale}</Td><Td align="right" numeric>{t.won}</Td><Td className="text-xs text-ink-secondary">{ago(t.lastUpdate)}</Td></tr>
            ))}</tbody>
          </Table></TableWrap>
        )}
      </Card>

      <ItemModal open={showCreate || !!editItem} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditItem(null); } }} item={editItem} members={members} leads={leads}
        onSubmit={async (d) => { if (editItem) await patch(editItem, d, "Saved"); else await create(d); setShowCreate(false); setEditItem(null); }} />
      <NotesModal item={historyItem} onClose={() => setHistoryItem(null)} onAdd={async (t) => { if (historyItem) await addNote(historyItem, t); }} currentUserId={currentUserId} />
      <ConfirmModal open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)} title="Delete item" description={deleteItem ? `"${deleteItem.title}" and its notes will be deleted.` : ""} confirmLabel="Delete" destructive onConfirm={async () => { if (deleteItem) await remove(deleteItem); }} />
    </>
  );
}

function WeeklyAgenda({ items, onDiscussed, onOpen, onEdit }: { items: OwnerItemRow[]; onDiscussed: (i: OwnerItemRow) => void; onOpen: (i: OwnerItemRow) => void; onEdit: (i: OwnerItemRow) => void }) {
  if (items.length === 0) return <EmptyState icon={<Users />} title="Nothing queued for the weekly" description="Use the people icon on any item to bring it to the next weekly." />;
  const groups = ITEM_CATEGORIES.map((c) => ({ c, rows: items.filter((i) => i.category === c) })).filter((g) => g.rows.length);
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.c}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{CATEGORY_LABELS[g.c]} · {g.rows.length}</h3>
          <ul className="divide-y divide-border rounded-lg border border-border bg-white">
            {g.rows.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{i.title}</span><Badge tone={TONES[i.status as ItemStatus] ?? "neutral"}>{STATUS_LABELS[i.status as ItemStatus] ?? i.status}</Badge>{i.handler && <span className="text-xs text-ink-muted">{i.handler.name}</span>}</div>
                  {i.waitingOn && <div className="mt-1 text-xs text-amber-800">⏳ {i.waitingOn}</div>}
                  {i.nextStep && <div className="mt-1 text-xs text-ink-secondary">Next: {i.nextStep}</div>}
                  {i.notes && <div className="mt-1 text-xs text-ink-secondary line-clamp-3">{i.notes}</div>}
                  {i.updates[0] && <div className="mt-1 text-[11px] text-ink-muted">Last: {i.updates[0].text} · {fmtTime(i.updates[0].createdAt)}</div>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => onDiscussed(i)}>Discussed</Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Notes" onClick={() => onOpen(i)}><History className="h-4 w-4" /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => onEdit(i)}><Pencil className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

type Draft = { title: string; category: ItemCategory; status: ItemStatus; waitingOn: string | null; handlerId: string | null; leadId: string | null; nextStep: string | null; dueAt: string | null; notes: string | null; forWeekly: boolean };

function ItemModal({ open, onOpenChange, item, members, leads, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; item: OwnerItemRow | null; members: Option[]; leads: { id: string; label: string }[]; onSubmit: (d: Draft) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget); const g = (k: string) => ((fd.get(k) as string | null) ?? "").trim() || null;
    setSaving(true);
    await onSubmit({ title: g("title") ?? "", category: (g("category") ?? "OTHER") as ItemCategory, status: (g("status") ?? "OPEN") as ItemStatus, waitingOn: g("waitingOn"), handlerId: g("handlerId"), leadId: g("leadId"), nextStep: g("nextStep"), dueAt: g("dueAt"), notes: g("notes"), forWeekly: fd.get("forWeekly") === "on" });
    setSaving(false);
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={item ? "Edit item" : "New item"} description={item ? undefined : "A lead to keep an eye on, a conversation, something stuck with legal, or a topic for the weekly."} size="lg">
      <form key={item?.id ?? "new"} onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Title" htmlFor="oi-title" required><Input id="oi-title" name="title" defaultValue={item?.title} required autoFocus placeholder="Shark Ninja — do we start legal?" /></FormGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormGroup label="Category" htmlFor="oi-cat"><Select id="oi-cat" name="category" defaultValue={item?.category ?? "OTHER"}>{ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</Select></FormGroup>
          <FormGroup label="Status" htmlFor="oi-status"><Select id="oi-status" name="status" defaultValue={item?.status ?? "OPEN"}>{ITEM_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</Select></FormGroup>
          <FormGroup label="Due" htmlFor="oi-due"><Input id="oi-due" name="dueAt" type="date" defaultValue={item?.dueAt ? item.dueAt.slice(0, 10) : ""} /></FormGroup>
          <FormGroup label="Who is handling it" htmlFor="oi-handler"><Select id="oi-handler" name="handlerId" defaultValue={item?.handler?.id ?? ""}><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></FormGroup>
          <FormGroup label="Related brand lead" htmlFor="oi-lead"><Select id="oi-lead" name="leadId" defaultValue={item?.lead?.id ?? ""}><option value="">—</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></FormGroup>
          <FormGroup label="Waiting on" htmlFor="oi-wait" hint="legal, the brand, a reply…"><Input id="oi-wait" name="waitingOn" defaultValue={item?.waitingOn ?? ""} /></FormGroup>
        </div>
        <FormGroup label="Next step" htmlFor="oi-next"><Input id="oi-next" name="nextStep" defaultValue={item?.nextStep ?? ""} /></FormGroup>
        <FormGroup label="Notes" htmlFor="oi-notes"><Textarea id="oi-notes" name="notes" rows={4} defaultValue={item?.notes ?? ""} /></FormGroup>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="forWeekly" defaultChecked={item?.forWeekly ?? false} className="h-4 w-4" /> Bring to the next weekly</label>
        <FormActions><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : item ? "Save" : "Add"}</Button></FormActions>
      </form>
    </Modal>
  );
}

function NotesModal({ item, onClose, onAdd, currentUserId }: { item: OwnerItemRow | null; onClose: () => void; onAdd: (text: string) => Promise<void> | void; currentUserId: string }) {
  const [text, setText] = useState("");
  return (
    <Modal open={item !== null} onOpenChange={(o) => !o && onClose()} title={item?.title ?? ""} description={item ? `${CATEGORY_LABELS[item.category as ItemCategory] ?? item.category} · ${STATUS_LABELS[item.status as ItemStatus] ?? item.status}${item.handler ? ` · ${item.handler.name}` : ""}` : undefined} size="lg">
      {item && (
        <div className="space-y-4">
          <form onSubmit={async (e) => { e.preventDefault(); if (!text.trim()) return; await onAdd(text.trim()); setText(""); }} className="flex gap-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="What happened, what was said, what we decided…" className="flex-1" />
            <Button type="submit" leftIcon={<MessageSquarePlus className="h-4 w-4" />} disabled={!text.trim()}>Add</Button>
          </form>
          {item.notes && <p className="rounded-md bg-surface-muted px-3 py-2 text-sm whitespace-pre-wrap">{item.notes}</p>}
          <ul className="max-h-[50vh] space-y-3 overflow-auto">
            {item.updates.length === 0 && <li className="text-sm text-ink-muted">No notes yet.</li>}
            {item.updates.map((u) => (
              <li key={u.id} className="border-l-2 border-border pl-3">
                <div className="text-sm whitespace-pre-wrap">{u.text}</div>
                <div className="text-[11px] text-ink-muted">{u.author.id === currentUserId ? "You" : u.author.name} · {fmtTime(u.createdAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
