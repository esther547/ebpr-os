"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  CalendarClock,
  CalendarRange,
  ExternalLink,
  ListPlus,
  Pencil,
  Plus,
  Search,
  Shapes,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/header";
import { Button, Input } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal } from "@/components/ui/modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuDots,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { EventModal, type EventDraft } from "./event-modal";
import {
  CATEGORY_CHIP_LABEL,
  CATEGORY_LABEL,
  EVENT_CATEGORIES,
  approxDateLabel,
  monthYearLabel,
  searchable,
  shortDateLabel,
  type EventCategoryValue,
  type UpcomingEventItem,
} from "./helpers";

type Props = {
  items: UpcomingEventItem[];
  /** Today in Miami, "yyyy-MM-dd". */
  todayKey: string;
  remindersThisMonth: number;
};

type Filter = "ALL" | EventCategoryValue;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function EventsPageClient({ items, todayKey, remindersThisMonth }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<UpcomingEventItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<UpcomingEventItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(
    () => ({
      total: items.length,
      soon: items.filter((i) => i.daysUntil <= 60).length,
      categories: new Set(items.map((i) => i.category)).size,
    }),
    [items]
  );

  const counts = useMemo(() => {
    const map = new Map<EventCategoryValue, number>();
    for (const i of items) map.set(i.category, (map.get(i.category) ?? 0) + 1);
    return map;
  }, [items]);

  const months = useMemo(() => {
    const q = searchable(query.trim());
    const visible = items.filter(
      (i) =>
        (filter === "ALL" || i.category === filter) &&
        (!q || searchable(`${i.name} ${i.city ?? ""} ${i.notes ?? ""}`).includes(q))
    );
    const groups = new Map<string, UpcomingEventItem[]>();
    for (const item of visible) {
      const key = item.occursKey.slice(0, 7);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()].map(([key, list]) => ({ key, items: list }));
  }, [items, filter, query]);

  // ─── Mutations ─────────────────────────────────────────

  async function request(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  }

  async function errorOf(res: Response, fallback: string) {
    const payload = await res.json().catch(() => ({}));
    return apiErrorMessage(payload, fallback);
  }

  async function saveEvent(draft: EventDraft): Promise<boolean> {
    const editing = editItem;
    const res = await request(editing ? `/api/events/${editing.id}` : "/api/events", {
      method: editing ? "PATCH" : "POST",
      body: JSON.stringify(draft),
    }).catch(() => null);
    if (!res || !res.ok) {
      toast({
        title: editing ? "No se pudo guardar el evento" : "No se pudo agregar el evento",
        description: res ? await errorOf(res, "Revisa los datos") : "Sin conexión",
        variant: "error",
      });
      return false;
    }
    toast({ title: editing ? "Evento actualizado" : "Evento agregado", variant: "success" });
    router.refresh();
    return true;
  }

  async function removeEvent(item: UpcomingEventItem) {
    setDeleting(true);
    try {
      const res = await request(`/api/events/${item.id}`, { method: "DELETE" }).catch(() => null);
      if (!res || !res.ok) {
        toast({
          title: "No se pudo eliminar el evento",
          description: res ? await errorOf(res, "Inténtalo de nuevo") : "Sin conexión",
          variant: "error",
        });
        return;
      }
      setDeleteItem(null);
      toast({ title: "Evento eliminado", variant: "success" });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function createPriority(item: UpcomingEventItem) {
    const res = await request(`/api/events/${item.id}/priority`, { method: "POST" }).catch(() => null);
    if (res?.status === 409) {
      toast({ title: "Ya está en las prioridades de esta semana", description: item.name });
      return;
    }
    if (!res || !res.ok) {
      toast({
        title: "No se pudo crear la prioridad",
        description: res ? await errorOf(res, "Inténtalo de nuevo") : "Sin conexión",
        variant: "error",
      });
      return;
    }
    toast({
      title: "Prioridad creada para esta semana",
      description: `Trabajar oportunidad: ${item.name}`,
      variant: "success",
    });
  }

  // ─── Render ────────────────────────────────────────────

  const chips: { value: Filter; label: string; count: number }[] = [
    { value: "ALL", label: "Todos", count: items.length },
    ...EVENT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_CHIP_LABEL[c], count: counts.get(c) ?? 0 })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Próximos 12 meses"
        title="Calendario de eventos"
        subtitle="Premios, semanas de la moda, galas y estrenos. Avisamos al equipo con tiempo para trabajar cada oportunidad."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
            Evento
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Eventos en 12 meses" value={stats.total} icon={<CalendarRange />} />
        <StatTile label="Próximos 60 días" value={stats.soon} icon={<CalendarClock />} />
        <StatTile label="Avisos este mes" value={remindersThisMonth} icon={<BellRing />} hint="Recordatorios enviados" />
        <StatTile label="Categorías" value={stats.categories} icon={<Shapes />} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<CalendarRange />}
          title="Todavía no hay eventos en el calendario"
          description="Agrega los eventos del año y te recordamos con 2 meses de anticipación."
          action={
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
              Evento
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="Filtrar por categoría">
              {chips.map((chip) => {
                const active = filter === chip.value;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(chip.value)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/25",
                      active
                        ? "border-ink-primary bg-ink-primary text-white"
                        : "border-border bg-white text-ink-secondary hover:border-border-strong hover:text-ink-primary"
                    )}
                  >
                    {chip.label}
                    <span className={cn("tabular", active ? "text-white/60" : "text-ink-muted")}>{chip.count}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar evento o ciudad…"
                aria-label="Buscar evento"
                className="pl-9"
              />
            </div>
          </div>

          {months.length === 0 ? (
            <EmptyState
              compact
              icon={<Search />}
              title="Ningún evento coincide"
              description="Prueba con otra categoría u otra búsqueda."
            />
          ) : (
            <div className="space-y-4">
              {months.map((month) => (
                <Card key={month.key} padding="none" as="section" className="px-4 pt-4 sm:px-5 sm:pt-5">
                  <CardHeader
                    className="mb-1"
                    title={capitalize(monthYearLabel(month.key))}
                    description={`${month.items.length} ${month.items.length === 1 ? "evento" : "eventos"}`}
                  />
                  <ul className="divide-y divide-border">
                    {month.items.map((item) => (
                      <EventRow
                        key={item.id}
                        item={item}
                        todayKey={todayKey}
                        onPriority={() => void createPriority(item)}
                        onEdit={() => setEditItem(item)}
                        onDelete={() => setDeleteItem(item)}
                      />
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <EventModal
        open={showCreate}
        onOpenChange={setShowCreate}
        item={null}
        defaultMonth={Number(todayKey.slice(5, 7))}
        onSubmit={saveEvent}
      />
      <EventModal
        open={editItem !== null}
        onOpenChange={(open) => !open && setEditItem(null)}
        item={editItem}
        defaultMonth={Number(todayKey.slice(5, 7))}
        onSubmit={saveEvent}
      />
      <ConfirmModal
        open={deleteItem !== null}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Eliminar evento"
        description={deleteItem ? `${deleteItem.name} se quitará del calendario y ya no habrá recordatorios.` : undefined}
        confirmLabel="Eliminar"
        destructive
        loading={deleting}
        onConfirm={() => {
          if (deleteItem) void removeEvent(deleteItem);
        }}
      />
    </>
  );
}

function EventRow({
  item,
  todayKey,
  onPriority,
  onEdit,
  onDelete,
}: {
  item: UpcomingEventItem;
  todayKey: string;
  onPriority: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const due = item.remindKey <= todayKey;
  const when =
    item.daysUntil === 0 ? "hoy" : item.daysUntil === 1 ? "mañana" : item.daysUntil <= 60 ? `en ${item.daysUntil} días` : null;

  return (
    <li className="group flex items-start gap-3 py-3">
      <div className="w-[4.75rem] shrink-0 pt-px">
        <p className="text-sm font-semibold text-ink-primary tabular">
          {approxDateLabel(item.occursKey, item.day != null)}
        </p>
        {when && <p className="mt-0.5 text-2xs font-medium text-accent2-ink">{when}</p>}
      </div>

      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium leading-snug text-ink-primary">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-baseline gap-1 hover:text-accent2"
            >
              {item.name}
              <ExternalLink className="h-3 w-3 shrink-0 self-center text-ink-muted" aria-hidden />
            </a>
          ) : (
            item.name
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-secondary">
          {item.city && <span className="mr-0.5">{item.city}</span>}
          <Badge tone="outline" size="xs">
            {CATEGORY_LABEL[item.category]}
          </Badge>
          <span
            title={
              item.reminded
                ? "El equipo ya recibió el recordatorio"
                : `Recordatorio ${item.leadDays} días antes`
            }
            className={cn(
              "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0 text-2xs font-medium ring-1 ring-inset",
              item.reminded
                ? "bg-accent2-soft text-accent2-ink ring-accent2/20"
                : due
                  ? "bg-white text-accent2-ink ring-accent2/30"
                  : "bg-white text-ink-secondary ring-border-strong"
            )}
          >
            {item.reminded ? <BellRing className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
            {item.reminded ? "avisado" : due ? "aviso pendiente" : `aviso el ${shortDateLabel(item.remindKey)}`}
          </span>
          {item.year == null ? null : (
            <span className="text-2xs text-ink-muted">solo {item.year}</span>
          )}
        </div>
        {item.notes && <p className="mt-1 break-words text-xs text-ink-muted">{item.notes}</p>}
      </div>

      <DropdownMenu>
        <DropdownMenuDots label={`Acciones para ${item.name}`} className="-my-1 shrink-0" />
        <DropdownMenuContent>
          <DropdownMenuItem icon={<ListPlus />} onSelect={onPriority}>
            Crear prioridad esta semana
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Pencil />} onSelect={onEdit}>
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive icon={<Trash2 />} onSelect={onDelete}>
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
