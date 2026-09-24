"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  ListChecks,
  Plus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/form-field";
import { StatTile } from "@/components/ui/stat-tile";
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
  key: "TEAM" | "ESTHER" | "CAROLINA";
  path: string;
  title: string;
  subtitle: string;
  personal: boolean;
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
};

export function PrioritiesPageClient({
  board,
  initialItems,
  clients,
  teamMembers,
  weekKey,
  currentWeekKey,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [items, setItems] = useState(initialItems);
  const [onlyPending, setOnlyPending] = useState(false);
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

  const visible = onlyPending ? items.filter((i) => !i.isDone) : items;
  const general = visible.filter((i) => !i.clientId);
  const clientSections = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; items: PriorityItem[] }>();
    for (const item of visible) {
      if (!item.clientId) continue;
      const name = item.client?.name ?? "Cliente";
      const group = groups.get(item.clientId) ?? { id: item.clientId, name, items: [] };
      group.items.push(item);
      groups.set(item.clientId, group);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [visible]);

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

  async function addPriority(clientId: string | null, raw: string) {
    const { title, assigneeId } = parseQuickAdd(raw, teamMembers);
    if (!title) return;
    try {
      const created = await request<PriorityItem>("/api/priorities", {
        method: "POST",
        body: JSON.stringify({ week: weekKey, list: board.key, clientId, title, assigneeId }),
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

  const toggleDone = (item: PriorityItem) =>
    void patch(item, { isDone: !item.isDone }, { isDone: !item.isDone });

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

  async function movePriority(item: PriorityItem, clientId: string | null) {
    await patch(item, { clientId });
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

  const rowProps = {
    personal: board.personal,
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
        subtitle={isCurrentWeek ? board.subtitle : "Semana distinta a la actual."}
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
          <span className="ml-auto">
            <Button
              variant={onlyPending ? "primary" : "secondary"}
              size="sm"
              aria-pressed={onlyPending}
              onClick={() => setOnlyPending((v) => !v)}
            >
              Solo pendientes
            </Button>
          </span>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total" value={stats.total} icon={<ListChecks />} />
        <StatTile label="Hechas" value={stats.done} icon={<CheckCircle2 />} tone="success" />
        <StatTile label="Pendientes" value={stats.pending} icon={<CalendarDays />} />
        <StatTile label="Clientes" value={stats.clients} icon={<Users />} />
      </div>

      {items.length === 0 ? (
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
        <div className="space-y-4">
          <PrioritySectionCard
            clientId={null}
            title="General"
            items={general}
            {...rowProps}
          />
          {clientSections.map((section) => (
            <PrioritySectionCard
              key={section.id}
              clientId={section.id}
              title={section.name}
              href={board.personal ? undefined : `/clients/${section.id}/deliverables`}
              items={section.items}
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
        onSubmit={savePriority}
      />
      <PriorityModal
        open={editItem !== null}
        onOpenChange={(open) => !open && setEditItem(null)}
        item={editItem}
        clients={clients}
        teamMembers={teamMembers}
        onSubmit={savePriority}
      />
      <MovePriorityModal
        item={moveItem}
        clients={clients}
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
