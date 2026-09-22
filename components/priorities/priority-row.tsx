"use client";

import { useState } from "react";
import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuDots,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { initials, type PriorityItem } from "./helpers";

type Props = {
  item: PriorityItem;
  onToggle: (item: PriorityItem) => void;
  onRename: (item: PriorityItem, title: string) => void;
  onEdit: (item: PriorityItem) => void;
  onMove: (item: PriorityItem) => void;
  onDelete: (item: PriorityItem) => void;
};

export function PriorityRow({ item, onToggle, onRename, onEdit, onMove, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);

  function startEditing() {
    setDraft(item.title);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const title = draft.trim();
    if (title && title !== item.title) onRename(item, title);
  }

  return (
    <li className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2/70">
      <input
        type="checkbox"
        checked={item.isDone}
        onChange={() => onToggle(item)}
        aria-label={item.isDone ? `Marcar "${item.title}" como pendiente` : `Marcar "${item.title}" como hecha`}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-border-strong accent-ink-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/25"
      />

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
              }
            }}
            className="w-full rounded-md border border-ink-primary bg-white px-2 py-0.5 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-ink-primary/15"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className={cn(
              "block w-full break-words text-left text-sm leading-snug transition-colors",
              item.isDone ? "text-ink-muted line-through" : "text-ink-primary hover:text-accent2"
            )}
          >
            {item.title}
          </button>
        )}
        {item.notes && !editing && (
          <p className={cn("mt-0.5 break-words text-xs", item.isDone ? "text-ink-muted/70" : "text-ink-muted")}>
            {item.notes}
          </p>
        )}
      </div>

      {item.assignee && (
        <span title={item.assignee.name} className="mt-0.5 shrink-0">
          <Badge tone="outline" size="xs">
            {initials(item.assignee.name)}
          </Badge>
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuDots label="Acciones" className="-my-0.5 shrink-0 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:data-[state=open]:opacity-100" />
        <DropdownMenuContent>
          <DropdownMenuItem icon={<Pencil />} onSelect={() => onEdit(item)}>
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem icon={<ArrowRightLeft />} onSelect={() => onMove(item)}>
            Mover a otro cliente
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive icon={<Trash2 />} onSelect={() => onDelete(item)}>
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
