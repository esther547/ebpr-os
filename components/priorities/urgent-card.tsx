"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { PriorityRow } from "./priority-row";
import { PriorityModal, type PriorityDraft } from "./priority-modal";
import { isUrgentNow, type PriorityItem } from "./helpers";
import { announcePriorityChange, usePriorityChanges } from "./priority-sync";

/**
 * "Urgentes — lo que trabajo primero" (Esther, Nov 25 2026): the pending lines the owner flagged with the
 * «Urgente» button, gathered from every section of the board (and from what they have assigned on Prioridades).
 * A line leaves this card when it is done or when the flag is removed; it then shows again in its own section.
 */
export function UrgentCard({ items: initial }: { items: PriorityItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [editItem, setEditItem] = useState<PriorityItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PriorityItem | null>(null);
  useEffect(() => setItems(initial), [initial]);

  // A line flagged (or un-flagged, checked, deleted) in a section of the board shows up / leaves here at once.
  usePriorityChanges((change) => {
    setItems((prev) => {
      if (change.type === "delete") return prev.filter((i) => i.id !== change.id);
      const rest = prev.filter((i) => i.id !== change.item.id);
      const known = prev.find((i) => i.id === change.item.id);
      return isUrgentNow(change.item) ? [...rest, { ...known, ...change.item, list: known?.list ?? change.item.list }] : rest;
    });
  });

  // First flagged, first in the list.
  const sorted = useMemo(() => [...items].sort((a, b) => String(a.urgentAt ?? "").localeCompare(String(b.urgentAt ?? "")) || a.id.localeCompare(b.id)), [items]);

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(payload, "No se pudo completar la acción"));
    return payload.data as T;
  }
  const fail = (err: unknown, title: string) => toast({ title, description: err instanceof Error ? err.message : undefined, variant: "error" });

  async function patch(item: PriorityItem, body: Record<string, unknown>, optimistic: Partial<PriorityItem>) {
    announcePriorityChange({ type: "update", item: { ...item, ...optimistic } });
    try {
      const updated = await request<PriorityItem>(`/api/priorities/${item.id}`, { method: "PATCH", body: JSON.stringify(body) });
      announcePriorityChange({ type: "update", item: { ...updated, list: item.list } });
      router.refresh();
    } catch (err) {
      announcePriorityChange({ type: "update", item });
      fail(err, "No se pudo guardar el cambio");
    }
  }
  async function remove(item: PriorityItem) {
    setDeleteItem(null);
    announcePriorityChange({ type: "delete", id: item.id });
    try {
      await request(`/api/priorities/${item.id}`, { method: "DELETE" });
    } catch (err) {
      fail(err, "No se pudo eliminar");
    } finally {
      router.refresh();
    }
  }

  /** Where the line comes from: its client, its section of the board, or the team list. */
  const origin = (item: PriorityItem) => item.client?.name ?? item.category ?? (item.project ? null : item.list === "TEAM" ? "Prioridades" : null);

  return (
    <>
      <Card padding="none" className="mb-3 border-red-200 bg-red-50/40 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Flame className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
          <h2 className="text-sm font-semibold text-ink-primary">Urgentes</h2>
          <span className="text-xs text-ink-muted">
            lo que trabajo primero{sorted.length ? ` · ${sorted.length} pendiente${sorted.length === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        {sorted.length === 0 ? (
          <p className="px-1 pt-2 text-xs text-ink-muted">Nada urgente por ahora. Usa el botón «Urgente» de cualquier to do para pasarlo aquí.</p>
        ) : (
          <ul className="mt-1 divide-y divide-red-200/60">
            {sorted.map((item) => (
              <PriorityRow
                key={item.id}
                item={item}
                contextLabel={origin(item)}
                inUrgentSection
                onUrgent={(p) => void patch(p, { isUrgent: false }, { urgentAt: null })}
                onToggle={(p) => void patch(p, { isDone: !p.isDone }, { isDone: !p.isDone })}
                onRename={(p, title) => void patch(p, { title }, { title })}
                onEdit={(p) => setEditItem(p)}
                onDelete={(p) => setDeleteItem(p)}
              />
            ))}
          </ul>
        )}
      </Card>
      <PriorityModal
        open={editItem !== null}
        onOpenChange={(open) => !open && setEditItem(null)}
        item={editItem}
        clients={[]}
        teamMembers={[]}
        categories={undefined}
        showProject={editItem?.list === "TEAM"}
        onSubmit={async (draft: PriorityDraft) => {
          if (!editItem) return;
          const body = { title: draft.title, notes: draft.notes, ...(editItem.list === "TEAM" && draft.project !== undefined ? { project: draft.project } : {}) };
          await patch(editItem, body, body);
        }}
      />
      <ConfirmModal open={deleteItem !== null} onOpenChange={(open) => !open && setDeleteItem(null)} title="Eliminar to do" description={deleteItem?.title} confirmLabel="Eliminar" destructive onConfirm={() => { if (deleteItem) void remove(deleteItem); }} />
    </>
  );
}
