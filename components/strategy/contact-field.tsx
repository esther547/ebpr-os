"use client";

// "Contacto / fuente": the internal note of who/how to reach a strategy target
// or suggestion, written by the team or researched by Claude (web search).
// INTERNAL ONLY — never rendered in the client portal.

import { useEffect, useState } from "react";
import { ChevronDown, Pencil, Plus, RefreshCw, Search, UserSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, FormGroup, Textarea } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { CONTACT_NOTES_MAX } from "@/lib/contact-finder-format";

export type ContactValue = {
  contactNotes: string | null;
  contactSource: string | null;
  contactUpdatedAt: string | Date | null;
};

/** API endpoints of the contact of a strategy item / suggestion. */
export const contactEndpoints = {
  strategyItem: (clientId: string, itemId: string) => ({
    findUrl: `/api/clients/${clientId}/strategy/items/${itemId}/find-contact`,
    saveUrl: `/api/clients/${clientId}/strategy/items/${itemId}/contact`,
  }),
  suggestion: (clientId: string, id: string) => ({
    findUrl: `/api/clients/${clientId}/suggestions/${id}/find-contact`,
    saveUrl: `/api/clients/${clientId}/suggestions/${id}/contact`,
  }),
};

function fmtDate(d: string | Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "America/New_York" });
}

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g;

/** Text with clickable links. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-ink-primary underline decoration-border-strong underline-offset-2 hover:decoration-ink-primary"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/** The one control Esther asked for: a small "POSIBLE CONTACTO" button; the info only shows after a click. */
export function PossibleContactButton({
  open,
  onToggle,
  hasContact,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  hasContact: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      title={hasContact ? "Ver posible contacto" : "Sin contacto: buscar o agregar"}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/25",
        open
          ? "border-ink-primary bg-surface-2 text-ink-primary"
          : hasContact
            ? "border-border text-ink-primary hover:border-accent2 hover:text-accent2"
            : "border-border text-ink-muted hover:border-accent2 hover:text-accent2",
        className
      )}
    >
      <UserSearch className="h-3 w-3" />
      Posible contacto
      <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      {hasContact && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent2" aria-hidden />}
    </button>
  );
}

export function ContactField({
  findUrl,
  saveUrl,
  initial,
  className,
  onChange,
  collapsible = true,
}: {
  findUrl: string;
  saveUrl: string;
  initial: ContactValue;
  className?: string;
  onChange?: (value: ContactValue) => void;
  /** Default: hidden behind a "Posible contacto" button. Pass false when the parent already has that button. */
  collapsible?: boolean;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState<ContactValue>(initial);
  const [finding, setFinding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(!collapsible);

  useEffect(() => {
    if (!finding) return;
    setElapsed(0);
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [finding]);

  function apply(next: ContactValue) {
    setValue(next);
    onChange?.(next);
  }

  async function find() {
    setFinding(true);
    try {
      const res = await fetch(findUrl, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ title: apiErrorMessage(data, "No se pudo buscar el contacto"), variant: "error" });
        return;
      }
      apply({ contactNotes: data.contactNotes, contactSource: data.contactSource, contactUpdatedAt: data.contactUpdatedAt });
      setExpanded(true);
      const n = Array.isArray(data.raw?.candidates) ? data.raw.candidates.length : 0;
      const internal = Array.isArray(data.raw?.internal) ? data.raw.internal.length : 0;
      toast({
        title: "Búsqueda lista",
        description: `${internal ? `${internal} contacto${internal === 1 ? "" : "s"} interno${internal === 1 ? "" : "s"} · ` : ""}${n} posible${n === 1 ? "" : "s"} contacto${n === 1 ? "" : "s"}. Verifica antes de contactar.`,
        variant: "success",
      });
    } catch {
      toast({ title: "No se pudo buscar el contacto", description: "Revisa tu conexión e intenta de nuevo.", variant: "error" });
    } finally {
      setFinding(false);
    }
  }

  function openEdit() {
    setDraft(value.contactNotes ?? "");
    setEditOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(saveUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactNotes: draft }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ title: apiErrorMessage(data, "No se pudo guardar el contacto"), variant: "error" });
        return;
      }
      apply({ contactNotes: data.contactNotes, contactSource: data.contactSource, contactUpdatedAt: data.contactUpdatedAt });
      setEditOpen(false);
      toast({ title: data.contactNotes ? "Contacto guardado" : "Contacto borrado", variant: "success" });
    } catch {
      toast({ title: "No se pudo guardar el contacto", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const notes = value.contactNotes?.trim() ?? "";
  const long = notes.split("\n").length > 4 || notes.length > 320;
  const busy = finding || saving;

  if (collapsible && !open) {
    return (
      <div className={className}>
        <PossibleContactButton open={false} onToggle={() => setOpen(true)} hasContact={!!notes} />
      </div>
    );
  }

  return (
    <div className={className}>
      {collapsible && <PossibleContactButton open onToggle={() => setOpen(false)} hasContact={!!notes} className="mb-1.5" />}
      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {notes && value.contactSource && (
          <Badge tone={value.contactSource === "AI" ? "purple" : "neutral"} size="xs">
            {value.contactSource === "AI" ? "IA" : "Equipo"}
          </Badge>
        )}
        {notes && value.contactUpdatedAt && <span className="text-2xs text-ink-muted">{fmtDate(value.contactUpdatedAt)}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {notes ? (
            <>
              <Button size="xs" variant="ghost" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={openEdit} disabled={busy}>
                Editar
              </Button>
              <Button size="xs" variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={find} loading={finding} disabled={busy}>
                {finding ? "Investigando…" : "Buscar de nuevo"}
              </Button>
            </>
          ) : (
            <>
              <Button size="xs" variant="secondary" leftIcon={<Search className="h-3.5 w-3.5" />} onClick={find} loading={finding} disabled={busy}>
                {finding ? "Investigando…" : "Buscar contacto"}
              </Button>
              <Button size="xs" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openEdit} disabled={busy}>
                Agregar
              </Button>
            </>
          )}
        </div>
      </div>

      {finding ? (
        <p className="mt-1.5 text-xs text-ink-muted" aria-live="polite">
          Buscando bookers, productores, agencias de PR y canales oficiales… suele tardar 20–60 s{elapsed ? ` (${elapsed} s)` : ""}.
        </p>
      ) : notes ? (
        <div className="mt-1.5">
          <p className={cn("whitespace-pre-line break-words text-xs leading-relaxed text-ink-secondary", long && !expanded && "line-clamp-4")}>
            <Linkified text={notes} />
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-2xs font-medium text-ink-muted underline-offset-2 hover:text-ink-primary hover:underline"
            >
              {expanded ? "Ver menos" : "Ver todo"}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-ink-muted">Sin contacto</p>
      )}

      </div>

      {editOpen && (
        <Modal
          open={editOpen}
          onOpenChange={setEditOpen}
          title="Posible contacto"
          description="Quién nos abre la puerta y cómo llegar (booker, productor, agencia de PR, formulario). Solo lo ve el equipo."
          size="lg"
        >
          <form onSubmit={save} className="space-y-4">
            <FormGroup label="Contacto" htmlFor="contact-notes" description="Déjalo vacío y guarda para borrarlo.">
              <Textarea
                id="contact-notes"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={10}
                maxLength={CONTACT_NOTES_MAX}
                placeholder="p. ej. María Pérez — productora de segmento, Despierta América · maria@… · la conocimos en Premios Juventud"
                autoFocus
              />
            </FormGroup>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                Guardar
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/** Toggle for table rows: same "Posible contacto" button; the row renders the field below when open. */
export const ContactToggle = PossibleContactButton;

/** Contact field of one strategy item (endpoints derived from its ids). */
export function StrategyItemContact({
  item,
  className,
  onChange,
  collapsible,
}: {
  item: { id: string; clientId: string } & ContactValue;
  className?: string;
  onChange?: (value: ContactValue) => void;
  collapsible?: boolean;
}) {
  return (
    <ContactField
      {...contactEndpoints.strategyItem(item.clientId, item.id)}
      initial={{ contactNotes: item.contactNotes, contactSource: item.contactSource, contactUpdatedAt: item.contactUpdatedAt }}
      className={className}
      onChange={onChange}
      collapsible={collapsible}
    />
  );
}

type RowItem = { id: string; clientId: string } & ContactValue;

/** Per-row state for a table row with a collapsible contact field. */
export function useRowContact(item: RowItem) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<ContactValue>({
    contactNotes: item.contactNotes,
    contactSource: item.contactSource,
    contactUpdatedAt: item.contactUpdatedAt,
  });
  return {
    open,
    toggle: () => setOpen((o) => !o),
    hasContact: !!value.contactNotes?.trim(),
    item: { ...item, ...value } as RowItem,
    setValue,
  };
}
