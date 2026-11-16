"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/form-field";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { PrioritySectionCard } from "./priority-section-card";
import { PriorityModal, type PriorityDraft } from "./priority-modal";
import type { PriorityItem } from "./helpers";

type Person = { id: string; name: string };

/**
 * "Mis to dos" inside a personal board (Esther, Nov 16 2026: one board, not two): the lines assigned to the owner
 * this week on the team's Prioridades, with each line's client. Checking one here checks it on Prioridades.
 */
export function AssignedTeamCard({ items: initial, ownerId, weekKey, clientOrder = [], team = [] }: { items: PriorityItem[]; ownerId: string; weekKey: string; clientOrder?: string[]; team?: Person[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [editItem, setEditItem] = useState<PriorityItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PriorityItem | null>(null);
  useEffect(() => setItems(initial), [initial]);

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(payload, "No se pudo completar la acción"));
    return payload.data as T;
  }
  const fail = (err: unknown, title: string) => toast({ title, description: err instanceof Error ? err.message : undefined, variant: "error" });

  async function add(raw: string) {
    const title = raw.trim();
    if (!title) return;
    try {
      const created = await request<PriorityItem>("/api/priorities", { method: "POST", body: JSON.stringify({ week: weekKey, list: "TEAM", clientId: null, title, assigneeId: ownerId }) });
      setItems((prev) => [...prev, created]);
      router.refresh();
    } catch (err) { fail(err, "No se pudo agregar"); }
  }
  async function patch(item: PriorityItem, body: Record<string, unknown>, optimistic?: Partial<PriorityItem>) {
    const before = items;
    if (optimistic) setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...optimistic } : i)));
    try {
      const updated = await request<PriorityItem>(`/api/priorities/${item.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      router.refresh();
    } catch (err) { setItems(before); fail(err, "No se pudo guardar el cambio"); }
  }
  async function remove(item: PriorityItem) {
    setDeleteItem(null);
    const before = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try { await request(`/api/priorities/${item.id}`, { method: "DELETE" }); router.refresh(); } catch (err) { setItems(before); fail(err, "No se pudo eliminar"); }
  }

  const others = team.filter((t) => t.id !== ownerId);
  return (
    <div className="mb-3">
      <PrioritySectionCard
        clientId={null}
        title="Asignado a mí en Prioridades del equipo"
        href="/priorities"
        items={items}
        personal
        showClient
        clientOrder={clientOrder}
        headerActions={others.length ? (
          <Select value="" onChange={(e) => { if (e.target.value) router.push(`/todos/mios?user=${e.target.value}`); }} className="mr-1 h-7 w-auto text-xs" aria-label="Ver to dos de otra persona">
            <option value="">Ver to dos de…</option>
            {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        ) : undefined}
        onAdd={(_c, raw) => add(raw)}
        onToggle={(p) => void patch(p, { isDone: !p.isDone }, { isDone: !p.isDone })}
        onRename={(p, title) => void patch(p, { title }, { title })}
        onEdit={(p) => setEditItem(p)}
        onMove={(p) => setEditItem(p)}
        onDelete={(p) => setDeleteItem(p)}
      />
      <PriorityModal open={editItem !== null} onOpenChange={(open) => !open && setEditItem(null)} item={editItem} clients={[]} teamMembers={[]} categories={undefined} showProject
        onSubmit={async (draft: PriorityDraft) => { if (editItem) await patch(editItem, { title: draft.title, notes: draft.notes, project: draft.project ?? null }); }} />
      <ConfirmModal open={deleteItem !== null} onOpenChange={(open) => !open && setDeleteItem(null)} title="Eliminar to do" description={deleteItem?.title} confirmLabel="Eliminar" destructive onConfirm={() => { if (deleteItem) void remove(deleteItem); }} />
    </div>
  );
}
