"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
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
  onAdd,
  onToggle,
  onRename,
  onEdit,
  onMove,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const sorted = sortPriorities(items, showClient);

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
    <Card padding="sm" className="sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {href ? (
            <Link
              href={href}
              className="group inline-flex items-center gap-1 text-sm font-semibold text-ink-primary transition-colors hover:text-accent2"
            >
              <span className="truncate">{title}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-muted transition-colors group-hover:text-accent2" />
            </Link>
          ) : (
            <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
          )}
          <p className="mt-0.5 text-xs text-ink-muted">{countLabel(items)}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="mb-2 flex items-center gap-2"
      >
        <div className="min-w-0 flex-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              }
            }}
            placeholder={personal ? "Agregar to do…" : "Agregar prioridad… @nombre para asignar"}
            aria-label={`${personal ? "Agregar to do a" : "Agregar prioridad a"} ${title}`}
            className="h-8 text-sm"
          />
        </div>
        <Button
          type="submit"
          size="icon-sm"
          variant="secondary"
          loading={saving}
          disabled={!draft.trim()}
          aria-label={personal ? "Agregar to do" : "Agregar prioridad"}
        >
          {!saving && <Plus className="h-4 w-4" />}
        </Button>
      </form>

      {sorted.length === 0 ? (
        <p className="px-2 py-3 text-xs text-ink-muted">{personal ? "Sin to dos todavía." : "Sin prioridades todavía."}</p>
      ) : (
        <ul className="-mx-2 divide-y divide-border/70">
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
