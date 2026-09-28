"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronRight, ChevronUp, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui/form-field";
import { PriorityRow } from "./priority-row";
import { countLabel, sortPriorities, type PriorityItem, type TeamMember } from "./helpers";

type Props = {
  /** Null for the agency-wide "General" list. */
  clientId: string | null;
  /** Category of this section on boards grouped by category. */
  category?: string | null;
  title: string;
  /** Client page link, when this card belongs to a client. */
  href?: string;
  items: PriorityItem[];
  /** Personal to-do boards: no assignees, simpler wording. */
  personal?: boolean;
  teamMembers?: TeamMember[];
  onAssign?: (item: PriorityItem, assigneeId: string | null) => void;
  /** Mixed lists: show each line's client. */
  showClient?: boolean;
  /** Mixed lists: Esther's client order for the week (most urgent first). */
  clientOrder?: string[];
  /** Client sections on the team board: move this client up/down (undefined = cannot). */
  onReorder?: (direction: -1 | 1) => void;
  isFirst?: boolean;
  isLast?: boolean;
  onAdd: (clientId: string | null, raw: string, category?: string | null) => Promise<void>;
  onToggle: (item: PriorityItem) => void;
  onRename: (item: PriorityItem, title: string) => void;
  onEdit: (item: PriorityItem) => void;
  onMove: (item: PriorityItem) => void;
  onDelete: (item: PriorityItem) => void;
};

export function PrioritySectionCard({
  clientId,
  category = null,
  title,
  href,
  items,
  personal = false,
  teamMembers = [],
  onAssign,
  showClient = false,
  clientOrder = [],
  onReorder,
  isFirst = false,
  isLast = false,
  onAdd,
  onToggle,
  onRename,
  onEdit,
  onMove,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const sorted = sortPriorities(items, showClient, clientOrder);
  const [collapsed, setCollapsed] = useState(false);
  // The add box stays hidden until asked for (or when the list is empty), so the page stays short.
  const [adding, setAdding] = useState(false);
  const showAdd = adding || sorted.length === 0;

  async function save() {
    const raw = draft.trim();
    if (!raw || saving) return;
    setSaving(true);
    try {
      await onAdd(clientId, raw, category);
      setDraft("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="none" className="group/card p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Mostrar ${title}` : `Ocultar ${title}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform", !collapsed && "rotate-90")} />
          <span className="truncate text-sm font-semibold text-ink-primary">{title}</span>
          <span className="shrink-0 text-xs text-ink-muted">{countLabel(items)}</span>
        </button>
        {/* Card tools stay out of the way until the card is hovered (always visible on touch). */}
        <div className="flex shrink-0 items-center md:opacity-0 md:transition-opacity md:group-hover/card:opacity-100 md:focus-within:opacity-100">
        {href && (
          <Link href={href} aria-label={`Abrir ${title}`} className="mr-1 shrink-0 text-ink-muted transition-colors hover:text-accent2">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={personal ? `Agregar to do a ${title}` : `Agregar prioridad a ${title}`}
          onClick={() => { setAdding((v) => !v); setCollapsed(false); }}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
        {onReorder && (
          <div className="flex shrink-0 items-center" title="Ordenar por urgencia">
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Subir ${title}`} disabled={isFirst} onClick={() => onReorder(-1)}>
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Bajar ${title}`} disabled={isLast} onClick={() => onReorder(1)}>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}
        </div>
      </div>

      {!collapsed && showAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="mt-2 flex items-center gap-2"
        >
          <div className="min-w-0 flex-1">
            <Input
              autoFocus={adding}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder={personal ? "Agregar to do…" : "Agregar prioridad… @nombre para asignar"}
              aria-label={`${personal ? "Nuevo to do en" : "Nueva prioridad en"} ${title}`}
              className="h-8 text-sm"
            />
          </div>
          <Button type="submit" size="icon-sm" variant="secondary" loading={saving} disabled={!draft.trim()} aria-label="Guardar">
            {!saving && <Plus className="h-4 w-4" />}
          </Button>
        </form>
      )}

      {collapsed ? null : sorted.length === 0 ? (
        <p className="px-1 pt-2 text-xs text-ink-muted">{personal ? "Sin to dos todavía." : "Sin prioridades todavía."}</p>
      ) : (
        <ul className="mt-1 divide-y divide-border/60">
          {sorted.map((item) => (
            <PriorityRow
              key={item.id}
              item={item}
              teamMembers={teamMembers}
              onAssign={onAssign}
              showClient={showClient}
              onToggle={onToggle}
              onRename={onRename}
              onEdit={onEdit}
              onMove={onMove}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
