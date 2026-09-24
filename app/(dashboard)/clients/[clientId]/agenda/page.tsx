import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { companionWhere } from "@/lib/companions";
import { ClientHeader } from "@/components/clients/client-header";
import { availabilityNowFor } from "@/lib/client-availability";
import { AgendaMonthSection } from "@/components/agenda/agenda-month-section";
import { AgendaAddItemButton } from "@/components/agenda/create-agenda-item-modal";
import { SyncDocButton } from "@/components/agenda/sync-doc-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { allocateAgendaMonths } from "@/lib/agenda-months";

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
    runner: item.runner ? { id: item.runner.id, name: item.runner.name } : null,
  }));

  // Report months: MES 1 holds the first `monthlyTarget` pautas, MES 2 the next… (lib/agenda-months.ts)
  const months = allocateAgendaMonths(items, client);

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
        {client.monthlyTarget
          ? `Reporte mensual: cada MES muestra ${client.monthlyTarget} ${client.monthlyTarget === 1 ? "meta" : "metas"} en orden cronológico; lo que sobra pasa al mes siguiente. `
          : ""}
        El Google Doc de la agenda se regenera cada noche desde el portal.
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No agenda items yet"
          description="Add scheduled appearances, TV slots, events, and red carpets."
        />
      ) : (
        <div className="space-y-8">
          {months.map((m) => (
            <AgendaMonthSection
              key={m.monthNumber}
              monthNumber={m.monthNumber}
              monthLabel={`${m.monthName} ${m.year}${m.target ? ` · ${m.items.length} de ${m.target}` : ""}`}
              items={m.items}
              runners={runners}
              clientId={client.id}
            />
          ))}
        </div>
      )}
    </>
  );
}

