import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientHeader } from "@/components/clients/client-header";
import { AgendaMonthSection } from "@/components/agenda/agenda-month-section";
import { AgendaAddItemButton } from "@/components/agenda/create-agenda-item-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays } from "lucide-react";
import { format, getMonth } from "date-fns";

type Props = { params: { clientId: string } };

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

export default async function AgendaPage({ params }: Props) {
  await requireUser();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, name: true, status: true, monthlyTarget: true, industry: true },
  });
  if (!client) notFound();

  const rawItems = await db.runnerAssignment.findMany({
    where: { clientId: params.clientId },
    orderBy: [{ monthNumber: "asc" }, { agendaSequence: "asc" }, { eventDate: "asc" }],
    include: {
      runner: { select: { id: true, name: true } },
    },
  });

  const runners = await db.user.findMany({
    where: { role: "RUNNER", isActive: true },
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
    runner: item.runner ? { id: item.runner.id, name: item.runner.name } : null,
  }));

  // Group by monthNumber (or derive from date)
  const byMonth = new Map<number, typeof items>();
  for (const item of items) {
    const monthKey = item.monthNumber ?? getMonth(new Date(item.eventDate)) + 1;
    const arr = byMonth.get(monthKey) ?? [];
    arr.push(item);
    byMonth.set(monthKey, arr);
  }

  const sortedMonths = Array.from(byMonth.keys()).sort((a, b) => a - b);

  return (
    <>
      <ClientHeader
        client={client}
        counts={{ agenda: items.length }}
        actions={
          <AgendaAddItemButton
            clientId={client.id}
            clientStatus={client.status}
            runners={runners}
            deliverables={linkableDeliverables}
          />
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No agenda items yet"
          description="Add scheduled appearances, TV slots, events, and red carpets."
        />
      ) : (
        <div className="space-y-8">
          {sortedMonths.map((monthNum) => {
            const monthItems = byMonth.get(monthNum) ?? [];
            const label = getMonthLabel(monthItems[0]?.eventDate ?? new Date());
            return (
              <AgendaMonthSection
                key={monthNum}
                monthNumber={monthNum}
                monthLabel={label}
                items={monthItems}
                runners={runners}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function getMonthLabel(sampleDate: Date): string {
  try {
    return format(new Date(sampleDate), "MMMM yyyy").toUpperCase();
  } catch {
    return "";
  }
}
