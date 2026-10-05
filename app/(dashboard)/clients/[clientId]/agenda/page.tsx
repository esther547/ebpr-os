import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { companionWhere } from "@/lib/companions";
import { ClientHeader } from "@/components/clients/client-header";
import { availabilityNowFor } from "@/lib/client-availability";
import { PeriodBoard, type PeriodCard, type GoalOnlyUnit } from "@/components/agenda/period-board";
import { AgendaAddItemButton } from "@/components/agenda/create-agenda-item-modal";
import { SyncDocButton } from "@/components/agenda/sync-doc-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { periodBoard } from "@/lib/service-periods";

type Props = { params: { clientId: string } };

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

export default async function AgendaPage({ params }: Props) {
  await requireUser();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, name: true, status: true, monthlyTarget: true, industry: true, cycleDay: true, goalsOwed: true, focusNote: true, agendaDocUrl: true },
  });
  if (!client) notFound();
  const availabilityNow = await availabilityNowFor(client.id);

  const rawItems = await db.runnerAssignment.findMany({
    where: { clientId: params.clientId },
    orderBy: [{ eventDate: "asc" }],
    include: {
      runner: { select: { id: true, name: true } },
    },
  });
  // Each pauta is listed under its goal's REPORT month (the month the goal was closed).
  const goalIds = rawItems.map((i) => i.deliverableId).filter((id): id is string => !!id);
  const goalMonths = new Map(
    (await db.deliverable.findMany({ where: { id: { in: goalIds } }, select: { id: true, month: true, year: true } })).map((g) => [g.id, { month: g.month, year: g.year }])
  );

  const runners = await db.user.findMany({
    where: companionWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const linkableDeliverables = await db.deliverable.findMany({
    where: { clientId: params.clientId, status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });

  // Transform to component shape
  const items = rawItems.map((item) => ({
    id: item.id,
    eventName: item.eventName,
    eventDate: item.eventDate,
    arrivalTime: item.arrivalTime,
    eventTime: item.eventTime,
    venueName: item.venueName,
    venueAddress: item.venueAddress,
    itemType: item.itemType,
    location: item.location,
    accompanistCount: item.accompanistCount,
    status: item.status,
    notes: item.notes,
    agendaSequence: item.agendaSequence,
    monthNumber: item.monthNumber,
    createdAt: item.createdAt,
    isProposal: item.isProposal,
    reportMonth: (item.deliverableId ? goalMonths.get(item.deliverableId) : null) ?? (item.agendaMonth && item.agendaYear ? { month: item.agendaMonth, year: item.agendaYear } : null),
    runner: item.runner ? { id: item.runner.id, name: item.runner.name } : null,
  }));

  // Service periods (lib/service-periods.ts): what each paid period holds, closed vs executed, pending review.
  const board = await periodBoard(client.id);
  const unitByPauta = new Map(board.periods.flatMap((pp) => pp.units).concat(board.pending).filter((u) => u.pautaId).map((u) => [u.pautaId!, u]));
  const withUnit = (it: (typeof items)[number]) => {
    const u = unitByPauta.get(it.id);
    return { ...it, unitState: u?.state, periodId: u?.periodId ?? null, coversPeriod: u?.coversPeriod ?? false, periodNote: u?.periodNote ?? null, goalValue: u?.goalValue ?? 1, needsReview: u?.needsReview ?? false, isProposal: it.isProposal };
  };
  const goalOnly = (units: typeof board.pending): GoalOnlyUnit[] =>
    units.filter((u) => !u.pautaId && u.goalId).map((u) => ({ goalId: u.goalId!, title: u.title, state: u.state, coversPeriod: u.coversPeriod, periodNote: u.periodNote, periodId: u.periodId, closedAt: u.closedAt?.toISOString() ?? null, executedAt: u.executedAt?.toISOString() ?? null, goalValue: u.goalValue }));
  const periodCards: PeriodCard[] = board.periods.map((pp) => ({
    id: pp.id, number: pp.number, label: pp.label, target: pp.target, refYear: pp.refYear, refMonth: pp.refMonth, note: pp.note,
    achieved: pp.achieved, closedPending: pp.closedPending, executed: pp.executed, missing: pp.missing, toReview: pp.toReview,
    items: items.filter((it) => unitByPauta.get(it.id)?.periodId === pp.id).map(withUnit),
    goalOnly: goalOnly(pp.units),
  }));
  const pendingIds = new Set(board.pending.filter((u) => u.pautaId).map((u) => u.pautaId!));
  const pendingCard = { items: items.filter((it) => pendingIds.has(it.id)).map(withUnit), goalOnly: goalOnly(board.pending) };
  const allItems = items.map(withUnit);
  const proposals = allItems.filter((it) => it.isProposal);

  // Activities on the agenda that nobody is accompanying yet.
  const needsRunnerCount = items.filter(
    (i) => !i.runner && (i.status === "SCHEDULED" || i.status === "CONFIRMED")
  ).length;

  return (
    <>
      <ClientHeader availabilityNow={availabilityNow}
        client={client}
        counts={{ agenda: items.length }}
        actions={
          <>
            <SyncDocButton clientId={client.id} hasDoc={!!client.agendaDocUrl} />
            <AgendaAddItemButton
              clientId={client.id}
              clientStatus={client.status}
              runners={runners}
              deliverables={linkableDeliverables}
            />
          </>
        }
      />

      {needsRunnerCount > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
          <Badge tone="danger" size="sm" dot>
            Needs runner
          </Badge>
          <p className="text-sm text-ink-secondary">
            {needsRunnerCount} {needsRunnerCount === 1 ? "activity has" : "activities have"} no
            runner yet — they are picked up by the weekly auto-assign, or you can assign someone on
            the runner schedule.
          </p>
        </div>
      )}

      <p className="mb-6 text-xs text-ink-muted">
        Cada período de servicio (Mes 1, Mes 2…) es la cuenta de las pautas conseguidas durante ese período: cuenta cuándo se consiguió, no cuándo se ejecuta. Una pauta puede valer más de una meta. El Google Doc no se reescribe: el portal solo le agrega las pautas nuevas.
      </p>

      <PeriodBoard
        clientId={client.id}
        canEdit
        runners={runners}
        periods={periodCards}
        pending={pendingCard}
        allItems={allItems}
        proposals={proposals}
        defaultTarget={client.monthlyTarget ?? 6}
      />
    </>
  );
}

