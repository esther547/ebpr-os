"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronDown, NotebookPen, CalendarDays, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, Input, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/layout/header";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { cn } from "@/lib/utils";
import type { ClientNoteDTO } from "@/lib/client-notes";

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

/**
 * Notes per meeting or topic: the why and the background behind the work, in full.
 * One card per note, folded to its title and date; open it to read everything.
 */
export function ClientNotes({ clientId, notes, canEdit }: { clientId: string; notes: ClientNoteDTO[]; canEdit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<ClientNoteDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<ClientNoteDTO | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set(notes.slice(0, 1).map((n) => n.id)));

  const toggle = (id: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  async function remove(note: ClientNoteDTO) {
    setDeleting(null);
    const res = await fetch(`/api/clients/${clientId}/notes/${note.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) { toast({ title: apiErrorMessage(data, "No se pudo borrar"), variant: "error" }); return; }
    toast({ title: "Nota borrada", variant: "success" });
    router.refresh();
  }

  return (
    <>
      <SectionHeader
        title="Notas"
        description="Una nota por reunión o tema, con el contexto completo. De aquí salen después los tasks."
        actions={canEdit ? <Button onClick={() => setEditing("new")} leftIcon={<Plus className="h-4 w-4" />}>Nueva nota</Button> : undefined}
      />

      {notes.length === 0 ? (
        <EmptyState icon={<NotebookPen />} title="Todavía no hay notas" description="Por ejemplo: «Notas reunión inicial» o «Notas del comunicado para lanzar ganador de 2 Latin Grammys»." action={canEdit ? <Button onClick={() => setEditing("new")} leftIcon={<Plus className="h-4 w-4" />}>Nueva nota</Button> : undefined} />
      ) : (
        <div className="space-y-3">
          {notes.map((n, i) => {
            const isOpen = open.has(n.id);
            return (
              <Card key={n.id} padding="none" className="overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <button type="button" onClick={() => toggle(n.id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <span className="mt-0.5 w-6 shrink-0 text-xs font-semibold tabular text-ink-muted">{i + 1}.</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink-primary">{n.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-ink-muted">
                        {n.meetingDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {fmtDate(n.meetingDate)}</span>}
                        {n.createdBy && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {n.createdBy.name.split(" ")[0]}</span>}
                        {!isOpen && <span className="truncate text-ink-muted/80">{n.body.replace(/\s+/g, " ").slice(0, 110)}{n.body.length > 110 ? "…" : ""}</span>}
                      </span>
                    </span>
                    <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-ink-muted transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button variant="ghost" size="icon-sm" aria-label="Editar nota" onClick={() => setEditing(n)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Borrar nota" onClick={() => setDeleting(n)} className="text-ink-muted hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
                {isOpen && (
                  <div className="border-t border-border bg-surface-1/60 px-4 py-4 sm:px-5 sm:pl-14">
                    <p className="max-w-prose whitespace-pre-line break-words text-sm leading-relaxed text-ink-primary">{n.body}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <NoteModal clientId={clientId} note={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); setOpen((prev) => new Set(prev).add(id)); router.refresh(); }} />
      )}
      <ConfirmModal open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)} title="Borrar esta nota" description={deleting?.title} confirmLabel="Borrar" destructive onConfirm={() => { if (deleting) void remove(deleting); }} />
    </>
  );
}

function NoteModal({ clientId, note, onClose, onSaved }: { clientId: string; note: ClientNoteDTO | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { title: String(f.get("title") || "").trim(), body: String(f.get("body") || "").trim(), meetingDate: String(f.get("meetingDate") || "") || null };
    setSaving(true);
    try {
      const res = await fetch(note ? `/api/clients/${clientId}/notes/${note.id}` : `/api/clients/${clientId}/notes`, { method: note ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast({ title: apiErrorMessage(data, "No se pudo guardar"), variant: "error" }); return; }
      toast({ title: note ? "Nota actualizada" : "Nota guardada", variant: "success" });
      onSaved(data.data.id);
    } finally { setSaving(false); }
  }
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={note ? "Editar nota" : "Nueva nota"} description="Escribe el contexto completo: lo que se habló, por qué, y qué se acordó." size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
          <FormGroup label="Título" htmlFor="note-title"><Input id="note-title" name="title" required defaultValue={note?.title ?? ""} placeholder="Notas reunión inicial" autoFocus /></FormGroup>
          <FormGroup label="Fecha de la reunión" htmlFor="note-date" hint="Opcional"><Input id="note-date" name="meetingDate" type="date" defaultValue={note?.meetingDate ?? ""} /></FormGroup>
        </div>
        <FormGroup label="Notas" htmlFor="note-body">
          <Textarea id="note-body" name="body" required rows={14} defaultValue={note?.body ?? ""} placeholder="Todo lo que haga falta recordar: storytelling, background, quién es quién, qué se acordó…" className="font-normal leading-relaxed" />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>{note ? "Guardar cambios" : "Guardar nota"}</Button>
        </FormActions>
      </form>
    </Modal>
  );
}
