"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Button, Select } from "@/components/ui/form-field";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { PrioritySectionCard } from "./priority-section-card";
import { PriorityModal, type PriorityDraft } from "./priority-modal";
import { shiftDayKey, weekRangeLabel, type PriorityItem } from "./helpers";

type Item = PriorityItem & { list: string };
type Person = { id: string; name: string };
type Props = { items: Item[]; target: Person; team: Person[]; viewerId: string; isAdmin: boolean; weekKey: string; currentWeekKey: string; clientOrder?: string[] };

export function MyTodosBoard({ items: initial, target, team, viewerId, isAdmin, weekKey, currentWeekKey, clientOrder = [] }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>(initial);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);
  useEffect(() => setItems(initial), [initial]);

  const base = `/todos/mios${isAdmin ? `?user=${target.id}` : ""}`;
  const withWeek = (w: string) => `${base}${base.includes("?") ? "&" : "?"}week=${w}`;
  const isCurrent = weekKey === currentWeekKey;
  const own = target.id;
  const viewingOther = target.id !== viewerId;
  const first = target.name.split(" ")[0];

  // Team lines carry their client (badge per line; the card sorts them by client).
  const fromTeam = useMemo(() => items.filter((i) => i.list === "TEAM"), [items]);
  const personal = useMemo(() => items.filter((i) => i.list === "PERSONAL"), [items]);
  const done = items.filter((i) => i.isDone).length;

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(payload, "No se pudo completar la acción"));
    return payload.data as T;
  }
  const fail = (err: unknown, title: string) => toast({ title, description: err instanceof Error ? err.message : undefined, variant: "error" });

  async function add(list: "TEAM" | "PERSONAL", raw: string) {
    const title = raw.trim();
    if (!title) return;
    try {
      const created = await request<PriorityItem>("/api/priorities", {
        method: "POST",
        body: JSON.stringify({ week: weekKey, list, clientId: null, title, assigneeId: own }),
      });
      setItems((prev) => [...prev, { ...created, list }]);
      router.refresh();
    } catch (err) {
      fail(err, "No se pudo agregar");
    }
  }
  async function patch(item: Item, body: Record<string, unknown>, optimistic?: Partial<Item>) {
    const before = items;
    if (optimistic) setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...optimistic } : i)));
    try {
      const updated = await request<PriorityItem>(`/api/priorities/${item.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...updated, list: item.list } : i)));
      router.refresh();
    } catch (err) {
      setItems(before);
      fail(err, "No se pudo guardar el cambio");
    }
  }
  // Ticking = done: the line is deleted right away, with a few seconds to undo.
  async function complete(item: Item) {
    const before = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await request(`/api/priorities/${item.id}`, { method: "DELETE" });
      router.refresh();
      toast({
        title: "Hecha ✓",
        description: item.title,
        variant: "success",
        duration: 6000,
        action: {
          label: "Deshacer",
          onClick: () =>
            void request<PriorityItem>("/api/priorities", {
              method: "POST",
              body: JSON.stringify({ week: weekKey, list: item.list, clientId: item.clientId, title: item.title, notes: item.notes, assigneeId: own }),
            })
              .then((created) => { setItems((prev) => [...prev, { ...created, list: item.list }]); router.refresh(); })
              .catch((err) => fail(err, "No se pudo deshacer")),
        },
      });
    } catch (err) {
      setItems(before);
      fail(err, "No se pudo marcar como hecha");
    }
  }
  async function remove(item: Item) {
    setDeleteItem(null);
    const before = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await request(`/api/priorities/${item.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setItems(before);
      fail(err, "No se pudo eliminar");
    }
  }

  const find = (p: PriorityItem) => items.find((i) => i.id === p.id);
  const rowProps = {
    personal: true,
    onToggle: (p: PriorityItem) => { const item = find(p); if (item) void complete(item); },
    onRename: (p: PriorityItem, title: string) => { const item = find(p); if (item) void patch(item, { title }, { title }); },
    onEdit: (p: PriorityItem) => setEditItem(find(p) ?? null),
    onMove: (p: PriorityItem) => setEditItem(find(p) ?? null),
    onDelete: (p: PriorityItem) => setDeleteItem(find(p) ?? null),
  };

  return (
    <>
      <PageHeader
        eyebrow={weekRangeLabel(weekKey)}
        title={viewingOther ? `To dos de ${first}` : "Mis to dos"}
        subtitle={`${items.length - done} pendiente${items.length - done === 1 ? "" : "s"} esta semana${isCurrent ? "" : " (semana distinta a la actual)"}`}
        actions={
          isAdmin ? (
            <Select value={target.id} onChange={(e) => router.push(`/todos/mios?user=${e.target.value}`)} className="h-9 w-auto min-w-[180px] text-sm" aria-label="Estratega">
              {team.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" size="icon-sm" aria-label="Semana anterior"><Link href={withWeek(shiftDayKey(weekKey, -7))}><ChevronLeft className="h-4 w-4" /></Link></Button>
          <Button asChild variant="secondary" size="icon-sm" aria-label="Semana siguiente"><Link href={withWeek(shiftDayKey(weekKey, 7))}><ChevronRight className="h-4 w-4" /></Link></Button>
          {!isCurrent && <Button asChild variant="ghost" size="sm"><Link href={base}>Esta semana</Link></Button>}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        <PrioritySectionCard clientId={null} title="Asignado en Prioridades del equipo" href="/priorities" items={fromTeam} showClient clientOrder={clientOrder} onAdd={(_c, raw) => add("TEAM", raw)} {...rowProps} />
        <PrioritySectionCard clientId={null} title={viewingOther ? `Pendientes de ${first}` : "Mis pendientes"} items={personal} onAdd={(_c, raw) => add("PERSONAL", raw)} {...rowProps} />
      </div>

      <PriorityModal
        open={editItem !== null}
        onOpenChange={(open) => !open && setEditItem(null)}
        item={editItem}
        clients={[]}
        teamMembers={[]}
        categories={undefined}
        onSubmit={async (draft: PriorityDraft) => {
          if (editItem) await patch(editItem, { title: draft.title, notes: draft.notes });
        }}
      />
      <ConfirmModal
        open={deleteItem !== null}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Eliminar to do"
        description={deleteItem?.title}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => { if (deleteItem) void remove(deleteItem); }}
      />
    </>
  );
}
