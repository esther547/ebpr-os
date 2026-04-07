import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { AgendaMonthSection } from "@/components/agenda/agenda-month-section";
import { format, getMonth } from "date-fns";

type Props = { params: { clientId: string } };

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

export default async function AgendaPage({ params }: Props) {
  await requireUser();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, name: true },
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
  });

  // Transform to component shape
  const items = rawItems.map((item) => ({
    id: item.id,
    eventName: item.notes ?? item.venueName ?? item.itemType ?? "Appearance",
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
    const monthKey =
      item.monthNumber ?? (getMonth(new Date(item.eventDate)) + 1);
    const arr = byMonth.get(monthKey) ?? [];
    arr.push(item);
    byMonth.set(monthKey, arr);
  }

  const sortedMonths = Array.from(byMonth.keys()).sort((a, b) => a - b);

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={`${client.name} · ${items.length} scheduled items`}
        actions={
          <button className="inline-flex h-9 items-center rounded-md bg-ink-primary px-4 text-sm font-medium text-ink-inverted hover:bg-ink-primary/90 transition-colors">
            + Add Item
          </button>
        }
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
          <p className="text-sm font-medium text-ink-primary">No agenda items yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Add scheduled appearances, TV slots, events, and red carpets.
          </p>
        </div>
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
