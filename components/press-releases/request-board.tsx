"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, FileText, Pencil, Send, Trash2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, FormActions, FormGroup, Input, Select, Textarea } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { REQUEST_STATUS_LABELS, type PressReleaseRequestItem, type RequestStatus } from "@/lib/press-release-requests-shared";

type ClientOption = { id: string; name: string };
type Props = {
  initialRequests: PressReleaseRequestItem[];
  clients: ClientOption[];
  /** The writer (Michel) or Esther: can take, deliver and close requests. */
  canWork: boolean;
  /** Strategists and Esther: can ask for a press release, edit or cancel it. */
  canRequest: boolean;
  /** Writer's name shown in the copy. */
  writerName: string;
  /** Request id to highlight (from a notification link). */
  highlightId?: string | null;
};

const TONES: Record<string, BadgeTone> = { REQUESTED: "warning", IN_PROGRESS: "info", DONE: "success", CANCELLED: "neutral" };

function fmt(iso: string, withWeekday = false) {
  return new Date(iso).toLocaleDateString("es-ES", { ...(withWeekday ? { weekday: "long" as const } : {}), day: "numeric", month: "short", year: "numeric", timeZone: "America/New_York" });
}
function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function RequestBoard({ initialRequests, clients, canWork, canRequest, writerName, highlightId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [requests, setRequests] = useState(initialRequests);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<PressReleaseRequestItem | null>(null);
  const [deliverItem, setDeliverItem] = useState<PressReleaseRequestItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PressReleaseRequestItem | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const groups = useMemo(() => {
    const open = requests.filter((r) => r.status === "REQUESTED" || r.status === "IN_PROGRESS").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const closed = requests.filter((r) => r.status === "DONE" || r.status === "CANCELLED").sort((a, b) => (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt));
    return { open, closed };
  }, [requests]);

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(payload, "No se pudo completar la acción"));
    return payload as T;
  }
  const fail = (err: unknown, title: string) => toast({ title, description: err instanceof Error ? err.message : undefined, variant: "error" });

  async function create(draft: RequestDraft) {
    try {
      const { data, notify } = await request<{ data: PressReleaseRequestItem; notify: { notified: number; emailed: boolean } }>("/api/press-release-requests", { method: "POST", body: JSON.stringify(draft) });
      setRequests((prev) => [data, ...prev]);
      toast({
        title: `Solicitud enviada a ${writerName}`,
        description: notify.emailed ? "Le llegó por correo y en el portal." : notify.notified ? "Le aparece en el portal (el correo aún no está configurado)." : "Guardada. No hay redactor activo para notificar.",
        variant: "success",
      });
      router.refresh();
    } catch (err) {
      fail(err, "No se pudo enviar la solicitud");
    }
  }
  async function patch(item: PressReleaseRequestItem, body: Record<string, unknown>, okTitle: string) {
    try {
      const { data } = await request<{ data: PressReleaseRequestItem }>(`/api/press-release-requests/${item.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setRequests((prev) => prev.map((r) => (r.id === item.id ? data : r)));
      toast({ title: okTitle, variant: "success" });
      router.refresh();
    } catch (err) {
      fail(err, "No se pudo guardar");
    }
  }
  async function remove(item: PressReleaseRequestItem) {
    setDeleteItem(null);
    try {
      await request(`/api/press-release-requests/${item.id}`, { method: "DELETE" });
      setRequests((prev) => prev.filter((r) => r.id !== item.id));
      router.refresh();
    } catch (err) {
      fail(err, "No se pudo eliminar");
    }
  }

  const card = (r: PressReleaseRequestItem) => {
    const days = daysUntil(r.dueDate);
    const open = r.status === "REQUESTED" || r.status === "IN_PROGRESS";
    return (
      <Card key={r.id} padding="md" className={cn(r.id === highlightId && "ring-2 ring-accent2", !open && "opacity-80")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-ink-primary">{r.client.name}</h3>
              <Badge tone={TONES[r.status] ?? "neutral"} size="xs" dot>{REQUEST_STATUS_LABELS[r.status as RequestStatus] ?? r.status}</Badge>
              {open && (
                <Badge tone={days < 0 ? "danger" : days <= 2 ? "warning" : "outline"} size="xs">
                  {days < 0 ? `Venció hace ${-days} ${-days === 1 ? "día" : "días"}` : days === 0 ? "Para hoy" : `Para el ${fmt(r.dueDate)} · ${days} ${days === 1 ? "día" : "días"}`}
                </Badge>
              )}
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-ink-primary">{r.news}</p>
            <dl className="mt-2 space-y-1 text-xs text-ink-secondary">
              <div><dt className="inline font-medium text-ink-muted">Fecha: </dt><dd className="inline">{fmt(r.dueDate, true)}</dd></div>
              {r.photosUrl && (
                <div className="flex items-center gap-1"><Camera className="h-3.5 w-3.5 text-ink-muted" /><a href={r.photosUrl} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2 hover:text-accent2">{r.photosUrl}</a></div>
              )}
              {r.info && <div><dt className="inline font-medium text-ink-muted">Info: </dt><dd className="inline whitespace-pre-line">{r.info}</dd></div>}
              <div><dt className="inline font-medium text-ink-muted">Pidió: </dt><dd className="inline">{r.requestedBy.name} · {fmt(r.createdAt)}</dd></div>
              {r.draftUrl && (
                <div className="flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-ink-muted" /><a href={r.draftUrl} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-ink-primary underline underline-offset-2 hover:text-accent2">{r.draftUrl}</a></div>
              )}
              {r.writerNotes && <div><dt className="inline font-medium text-ink-muted">{writerName}: </dt><dd className="inline whitespace-pre-line">{r.writerNotes}</dd></div>}
            </dl>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {canWork && r.status === "REQUESTED" && (
              <Button size="sm" variant="secondary" onClick={() => void patch(r, { status: "IN_PROGRESS" }, "Marcado en redacción")}>Lo tomo</Button>
            )}
            {canWork && open && (
              <Button size="sm" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setDeliverItem(r)}>Entregar</Button>
            )}
            {canRequest && open && (
              <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEditItem(r)}><Pencil className="h-4 w-4" /></Button>
            )}
            {canRequest && open && (
              <Button size="icon-sm" variant="ghost" aria-label="Cancelar" title="Cancelar solicitud" onClick={() => void patch(r, { status: "CANCELLED" }, "Solicitud cancelada")}><XCircle className="h-4 w-4" /></Button>
            )}
            {canRequest && !open && (
              <Button size="icon-sm" variant="ghost" aria-label="Eliminar" onClick={() => setDeleteItem(r)}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <section className="mb-10">
      <SectionHeader
        title={`Solicitudes a ${writerName}`}
        description={canWork && !canRequest ? "Lo que el equipo necesita que redactes, ordenado por fecha." : `Pide un comunicado con cliente, noticia y fecha. ${writerName} queda notificado al instante.`}
        actions={
          canRequest ? (
            <Button leftIcon={<Send className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
              Pedir comunicado
            </Button>
          ) : undefined
        }
      />
      {groups.open.length === 0 ? (
        <EmptyState
          compact
          icon={<FileText />}
          title="Sin solicitudes pendientes"
          description={canRequest ? `Cuando necesites un comunicado, pídeselo a ${writerName} desde aquí.` : "Cuando el equipo pida un comunicado te aparece aquí."}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">{groups.open.map(card)}</div>
      )}
      {groups.closed.length > 0 && (
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => setShowClosed((v) => !v)}>
            {showClosed ? "Ocultar entregados" : `Ver entregados y cancelados (${groups.closed.length})`}
          </Button>
          {showClosed && <div className="mt-3 grid gap-4 lg:grid-cols-2">{groups.closed.map(card)}</div>}
        </div>
      )}

      <RequestModal open={showCreate} onOpenChange={setShowCreate} item={null} clients={clients} writerName={writerName} onSubmit={create} />
      <RequestModal
        open={editItem !== null}
        onOpenChange={(o) => !o && setEditItem(null)}
        item={editItem}
        clients={clients}
        writerName={writerName}
        onSubmit={async (draft) => {
          if (editItem) await patch(editItem, { news: draft.news, dueDate: draft.dueDate, photosUrl: draft.photosUrl, info: draft.info }, "Solicitud actualizada");
        }}
      />
      <DeliverModal item={deliverItem} onClose={() => setDeliverItem(null)} onDeliver={(item, draftUrl, writerNotes) => patch(item, { status: "DONE", draftUrl, writerNotes }, "Comunicado entregado")} />
      <ConfirmModal
        open={deleteItem !== null}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title="Eliminar solicitud"
        description={deleteItem ? `${deleteItem.client.name}: ${deleteItem.news.slice(0, 80)}` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => { if (deleteItem) void remove(deleteItem); }}
      />
    </section>
  );
}

type RequestDraft = { clientId: string; news: string; dueDate: string; photosUrl: string | null; info: string | null };

function RequestModal({ open, onOpenChange, item, clients, writerName, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PressReleaseRequestItem | null;
  clients: ClientOption[];
  writerName: string;
  onSubmit: (draft: RequestDraft) => Promise<void>;
}) {
  const [clientId, setClientId] = useState("");
  const [news, setNews] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [photosUrl, setPhotosUrl] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setClientId(item?.clientId ?? "");
    setNews(item?.news ?? "");
    setDueDate(item ? item.dueDate.slice(0, 10) : "");
    setPhotosUrl(item?.photosUrl ?? "");
    setInfo(item?.info ?? "");
    setSaving(false);
  } else if (!open && wasOpen) setWasOpen(false);

  const valid = clientId && news.trim() && /^\d{4}-\d{2}-\d{2}$/.test(dueDate);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSubmit({ clientId, news: news.trim(), dueDate, photosUrl: photosUrl.trim() || null, info: info.trim() || null });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={item ? "Editar solicitud" : `Pedir comunicado a ${writerName}`} description={item ? undefined : "Cliente, noticia y fecha son obligatorios. Fotos e info son opcionales pero le ayudan."} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <FormGroup label="Cliente" htmlFor="prr-client" required>
          <Select id="prr-client" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={!!item} required>
            <option value="">Elige el cliente…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormGroup>
        <FormGroup label="Noticia" htmlFor="prr-news" required description="Qué anunciamos: el hecho, el ángulo, las citas que queremos.">
          <Textarea id="prr-news" rows={4} value={news} onChange={(e) => setNews(e.target.value)} placeholder="p. ej. Marko anuncia su gira por USA 2027: 12 ciudades, arranca en Miami el 3 de marzo…" autoFocus required />
        </FormGroup>
        <FormGroup label="Fecha en que lo necesitamos" htmlFor="prr-date" required>
          <Input id="prr-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </FormGroup>
        <FormGroup label="Fotos" htmlFor="prr-photos" description="Link a la carpeta (Drive, Dropbox, WeTransfer).">
          <Input id="prr-photos" type="url" value={photosUrl} onChange={(e) => setPhotosUrl(e.target.value)} placeholder="https://drive.google.com/…" />
        </FormGroup>
        <FormGroup label="Info adicional" htmlFor="prr-info" description="Bio, datos, links de referencia, tono, a quién va dirigido.">
          <Textarea id="prr-info" rows={3} value={info} onChange={(e) => setInfo(e.target.value)} />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="submit" loading={saving} disabled={!valid} leftIcon={item ? undefined : <Send className="h-4 w-4" />}>{item ? "Guardar" : "Enviar solicitud"}</Button>
        </FormActions>
      </form>
    </Modal>
  );
}

function DeliverModal({ item, onClose, onDeliver }: { item: PressReleaseRequestItem | null; onClose: () => void; onDeliver: (item: PressReleaseRequestItem, draftUrl: string | null, writerNotes: string | null) => Promise<void> }) {
  const [draftUrl, setDraftUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setDraftUrl(item.draftUrl ?? "");
    setNotes(item.writerNotes ?? "");
    setSaving(false);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || saving) return;
    setSaving(true);
    try {
      await onDeliver(item, draftUrl.trim() || null, notes.trim() || null);
      onClose();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={item !== null} onOpenChange={(o) => !o && onClose()} title="Entregar comunicado" description={item ? `${item.client.name}: ${item.news.slice(0, 90)}` : undefined}>
      <form onSubmit={submit} className="space-y-4">
        <FormGroup label="Link del comunicado" htmlFor="prr-draft" description="Google Doc, Word en Drive, etc.">
          <Input id="prr-draft" type="url" value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder="https://docs.google.com/document/d/…" autoFocus />
        </FormGroup>
        <FormGroup label="Comentarios" htmlFor="prr-notes">
          <Textarea id="prr-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" loading={saving} leftIcon={<CheckCircle2 className="h-4 w-4" />}>Marcar entregado</Button>
        </FormActions>
      </form>
    </Modal>
  );
}
