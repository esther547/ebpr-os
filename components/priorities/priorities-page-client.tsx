"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  ListChecks,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { PrioritySectionCard } from "./priority-section-card";
import { MovePriorityModal, PriorityModal, type PriorityDraft } from "./priority-modal";
import {
  parseQuickAdd,
  shiftDayKey,
  weekRangeLabel,
  type ClientOption,
  type PriorityItem,
  type TeamMember,
} from "./helpers";

export type BoardInfo = {
  key: "TEAM" | "ESTHER" | "CAROLINA" | "LEGAL" | "PERSONAL";
  path: string;
  title: string;
  subtitle: string;
  personal: boolean;
  /** Group by these categories instead of by client. */
  categories?: string[];
};

type Props = {
  board: BoardInfo;
  initialItems: PriorityItem[];
  clients: ClientOption[];
  teamMembers: TeamMember[];
  /** Monday of the displayed week, "yyyy-MM-dd" (Miami). */
  weekKey: string;
  /** Monday of the current week, "yyyy-MM-dd" (Miami). */
  currentWeekKey: string;
  /** Team board: Esther's client order for this week (most urgent first). */
  clientOrder?: string[];
  /** Whether the viewer may reorder clients (admin). */
  canReorder?: boolean;
};

export function PrioritiesPageClient({
  board,
  initialItems,
  clients,
  teamMembers,
  weekKey,
  currentWeekKey,
  clientOrder: initialClientOrder = [],
  canReorder = false,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [clientOrder, setClientOrder] = useState<string[]>(initialClientOrder);
  useEffect(() => setClientOrder(initialClientOrder), [initialClientOrder]);

  const [items, setItems] = useState(initialItems);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<PriorityItem | null>(null);
  const [moveItem, setMoveItem] = useState<PriorityItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PriorityItem | null>(null);
  const [confirmCarryOver, setConfirmCarryOver] = useState(false);
  const [carrying, setCarrying] = useState(false);

  // The server is the source of truth; optimistic edits are replaced on refresh.
  useEffect(() => setItems(initialItems), [initialItems]);

  const prevWeek = shiftDayKey(weekKey, -7);
  const nextWeek = shiftDayKey(weekKey, 7);
  const isCurrentWeek = weekKey === currentWeekKey;

  const stats = useMemo(() => {
    const done = items.filter((i) => i.isDone).length;
    const clientIds = new Set(items.filter((i) => i.clientId).map((i) => i.clientId));
    return { total: items.length, done, pending: items.length - done, clients: clientIds.size };
  }, [items]);

  const visible = items;
  const general = visible.filter((i) => (board.categories ? !i.category : !i.clientId));
  const categorySections = useMemo(() => {
    if (!board.categories) return [];
    return board.categories.map((c) => ({ key: c, items: visible.filter((i) => i.category === c) }));
  }, [board.categories, visible]);
  const clientSections = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; items: PriorityItem[] }>();
    for (const item of visible) {
      if (!item.clientId) continue;
      const name = item.client?.name ?? "Cliente";
      const group = groups.get(item.clientId) ?? { id: item.clientId, name, items: [] };
      group.items.push(item);
      groups.set(item.clientId, group);
    }
    // Esther's manual order first (most urgent this week); anyone not placed yet goes after, A–Z.
    const rank = new Map(clientOrder.map((id, i) => [id, i]));
    const rankOf = (id: string) => (rank.has(id) ? (rank.get(id) as number) : Number.MAX_SAFE_INTEGER);
    return [...groups.values()].sort((a, b) => rankOf(a.id) - rankOf(b.id) || a.name.localeCompare(b.name, "es"));
  }, [visible, clientOrder]);

  async function reorderClient(clientId: string, direction: -1 | 1) {
    const ids = clientSections.map((s) => s.id);
    const from = ids.indexOf(clientId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    const before = clientOrder;
    setClientOrder(ids);
    try {
      await request("/api/priorities/client-order", { method: "PUT", body: JSON.stringify({ week: weekKey, clientIds: ids }) });
      router.refresh();
    } catch (err) {
      setClientOrder(before);
      failed(err, "No se pudo guardar el orden");
    }
  }

  // ─── Mutations ─────────────────────────────────────────

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(payload, "No se pudo completar la acción"));
    return payload.data as T;
  }

  function failed(err: unknown, fallback: string) {
    toast({
      title: fallback,
      description: err instanceof Error ? err.message : undefined,
      variant: "error",
    });
  }

  async function addPriority(clientId: string | null, raw: string, category?: string | null) {
    const { title, assigneeId } = parseQuickAdd(raw, teamMembers);
    if (!title) return;
    try {
      const created = await request<PriorityItem>("/api/priorities", {
        method: "POST",
        body: JSON.stringify({ week: weekKey, list: board.key, clientId, category: category ?? null, title, assigneeId }),
      });
      setItems((prev) => [...prev, created]);
      router.refresh();
    } catch (err) {
      failed(err, "No se pudo agregar la prioridad");
    }
  }

  async function patch(item: PriorityItem, body: Record<string, unknown>, optimistic?: Partial<PriorityItem>) {
    const before = items;
    if (optimistic) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...optimistic } : i)));
    }
    try {
      const updated = await request<PriorityItem>(`/api/priorities/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      router.refresh();
    } catch (err) {
      setItems(before);
      failed(err, "No se pudo guardar el cambio");
    }
  }

  // Ticking a line marks it done: it stays crossed out and the nightly cron removes it 20 days later.
  const toggleDone = (item: PriorityItem) => void patch(item, { isDone: !item.isDone }, { isDone: !item.isDone });

  const renamePriority = (item: PriorityItem, title: string) =>
    void patch(item, { title }, { title });

  async function savePriority(draft: PriorityDraft) {
    if (!editItem) {
      try {
        const created = await request<PriorityItem>("/api/priorities", {
          method: "POST",
          body: JSON.stringify({ week: weekKey, list: board.key, ...draft }),
        });
        setItems((prev) => [...prev, created]);
        router.refresh();
      } catch (err) {
        failed(err, "No se pudo agregar la prioridad");
      }
      return;
    }
    await patch(editItem, draft);
  }

  async function movePriority(item: PriorityItem, clientId: string | null, category?: string | null) {
    await patch(item, board.categories ? { category: category ?? null } : { clientId });
  }

  async function removePriority(item: PriorityItem) {
    const before = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setDeleteItem(null);
    try {
      await request(`/api/priorities/${item.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setItems(before);
      failed(err, "No se pudo eliminar la prioridad");
    }
  }

  async function carryOver(fromWeek: string, toWeek: string) {
    setCarrying(true);
    try {
      const result = await request<{ count: number }>("/api/priorities/carry-over", {
        method: "POST",
        body: JSON.stringify({ fromWeek, toWeek, list: board.key }),
      });
      setConfirmCarryOver(false);
      toast({
        title:
          result.count === 0
            ? "No había pendientes para copiar"
            : `${result.count} ${result.count === 1 ? "prioridad copiada" : "prioridades copiadas"}`,
        variant: "success",
      });
      router.refresh();
    } catch (err) {
      failed(err, "No se pudieron copiar las prioridades");
    } finally {
      setCarrying(false);
    }
  }

  // ─── Render ────────────────────────────────────────────

  const assignPriority = (item: PriorityItem, assigneeId: string | null) =>
    void patch(item, { assigneeId }, { assigneeId, assignee: teamMembers.find((m) => m.id === assigneeId) ?? null });

  const rowProps = {
    personal: board.personal,
    teamMembers: board.personal ? [] : teamMembers,
    onAssign: assignPriority,
    onAdd: addPriority,
    onToggle: toggleDone,
    onRename: renamePriority,
    onEdit: (item: PriorityItem) => setEditItem(item),
    onMove: (item: PriorityItem) => setMoveItem(item),
    onDelete: (item: PriorityItem) => setDeleteItem(item),
  };

  return (
    <>
      <PageHeader
        eyebrow={weekRangeLabel(weekKey)}
        title={board.title}
        subtitle={`${stats.pending} pendiente${stats.pending === 1 ? "" : "s"}${stats.done ? ` · ${stats.done} hecha${stats.done === 1 ? "" : "s"}` : ""}${board.categories ? "" : ` · ${stats.clients} cliente${stats.clients === 1 ? "" : "s"}`}${isCurrentWeek ? "" : " · semana distinta a la actual"}`}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<CopyPlus className="h-4 w-4" />}
              onClick={() => setConfirmCarryOver(true)}
            >
              Copiar pendientes a la próxima semana
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
              {board.personal ? "To do" : "Prioridad"}
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" size="icon-sm" aria-label="Semana anterior">
            <Link href={`${board.path}?week=${prevWeek}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="icon-sm" aria-label="Semana siguiente">
            <Link href={`${board.path}?week=${nextWeek}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          {!isCurrentWeek && (
            <Button asChild variant="ghost" size="sm">
              <Link href={board.path}>Esta semana</Link>
            </Button>
          )}
        </div>
      </PageHeader>

      {items.length === 0 && !board.categories ? (
        <EmptyState
          icon={<ListChecks />}
          title={board.personal ? "Todavía no hay to dos para esta semana" : "Todavía no hay prioridades para esta semana"}
          description={board.personal ? "Anota lo tuyo o copia los pendientes de la semana pasada." : "Agrega la lista de la reunión o copia los pendientes de la semana pasada."}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="secondary"
                leftIcon={<CopyPlus className="h-4 w-4" />}
                loading={carrying}
                onClick={() => void carryOver(prevWeek, weekKey)}
              >
                Copiar pendientes de la semana pasada
              </Button>
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
                {board.personal ? "To do" : "Prioridad"}
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
          {categorySections.map((section) => (
            <PrioritySectionCard
              key={section.key}
              clientId={null}
              category={section.key}
              title={section.key}
              items={section.items}
              {...rowProps}
            />
          ))}
          {(!board.categories || general.length > 0) && (
            <PrioritySectionCard
              clientId={null}
              title={board.categories ? "Sin categoría" : "General"}
              items={general}
              {...rowProps}
            />
          )}
          {!board.categories && clientSections.map((section, i) => (
            <PrioritySectionCard
              key={section.id}
              clientId={section.id}
              title={section.name}
              href={board.personal ? undefined : `/clients/${section.id}/deliverables`}
              items={section.items}
              onReorder={canReorder && !board.personal ? (dir) => void reorderClient(section.id, dir) : undefined}
              isFirst={i === 0}
              isLast={i === clientSections.length - 1}
              {...rowProps}
            />
          ))}
        </div>
      )}

      <PriorityModal
        open={showCreate}
        onOpenChange={setShowCreate}
        item={null}
        clients={clients}
        teamMembers={teamMembers}
        categories={board.categories}
        onSubmit={savePriority}
      />
      <PriorityModal
        open={editItem !== null}
        onOpenChange={(open) => !open && setEditItem(null)}
        item={editItem}
        clients={clients}
        teamMembers={teamMembers}
        categories={board.categories}
        onSubmit={savePriority}
      />
      <MovePriorityModal
        item={moveItem}
        clients={clients}
        categories={board.categories}
        onClose={() => setMoveItem(null)}
        onMove={movePriority}
      />
      <ConfirmModal
        open={deleteItem !== null}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Eliminar prioridad"
        description={deleteItem?.title}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (deleteItem) void removePriority(deleteItem);
        }}
      />
      <ConfirmModal
        open={confirmCarryOver}
        onOpenChange={setConfirmCarryOver}
        title="Copiar pendientes a la próxima semana"
        description={`Se copiarán las prioridades sin terminar a la ${weekRangeLabel(nextWeek).toLowerCase()}. Las que ya existan no se duplican.`}
        confirmLabel="Copiar"
        loading={carrying}
        onConfirm={() => void carryOver(weekKey, nextWeek)}
      />
    </>
  );
}
