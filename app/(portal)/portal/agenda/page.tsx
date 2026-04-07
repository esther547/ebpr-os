import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
export const metadata = { title: "My Agenda" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Goal",
  CONFIRMED: "Confirmed",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-surface-2 text-ink-muted",
  CONFIRMED: "bg-green-50 text-green-700",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-50 text-red-600",
};

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function PortalAgendaPage() {
  const clientUser = await getCurrentClientUser();
  if (!clientUser) redirect("/sign-in");

  const now = new Date();
  const currentYear = now.getFullYear();

  // Fetch all agenda items from current year onward
  const items = await db.runnerAssignment.findMany({
    where: {
      clientId: clientUser.clientId,
      eventDate: { gte: new Date(`${currentYear}-01-01`) },
    },
    orderBy: [
      { monthNumber: "asc" },
      { agendaSequence: "asc" },
      { eventDate: "asc" },
    ],
    include: {
      runner: { select: { id: true, name: true } },
    },
  });

  // Group by monthNumber
  const byMonth = new Map<number, typeof items>();
  for (const item of items) {
    const key = item.monthNumber ?? getMonthNumber(item.eventDate);
    const arr = byMonth.get(key) ?? [];
    arr.push(item);
    byMonth.set(key, arr);
  }

  const sortedMonths = Array.from(byMonth.keys()).sort((a, b) => a - b);

  // Derive calendar month from the first item in the month group for labeling
  const getMonthLabel = (monthNum: number, monthItems: typeof items) => {
    const first = monthItems[0];
    const d = first ? new Date(first.eventDate) : null;
    const calMonth = d ? MONTH_NAMES[d.getMonth() + 1] : "";
    const calYear = d ? d.getFullYear() : currentYear;
    return calMonth
      ? `MES ${monthNum} — ${calMonth.toUpperCase()} ${calYear}`
      : `MES ${monthNum}`;
  };

  const upcomingCount = items.filter(
    (i) =>
      i.status === "SCHEDULED" ||
      i.status === "CONFIRMED"
  ).length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-primary">My Agenda</h1>
        <p className="mt-1 text-ink-secondary">
          {upcomingCount > 0
            ? `${upcomingCount} upcoming appearance${upcomingCount !== 1 ? "s" : ""}`
            : "Your schedule for this year"}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
          <p className="text-sm font-medium text-ink-primary">No agenda yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Your upcoming appearances will appear here once scheduled.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedMonths.map((monthNum) => {
            const monthItems = byMonth.get(monthNum) ?? [];
            const label = getMonthLabel(monthNum, monthItems);

            return (
              <section key={monthNum}>
                {/* Month header */}
                <div className="mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">
                    {label}
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-white overflow-hidden divide-y divide-border">
                  {monthItems.map((item, idx) => (
                    <AgendaRow key={item.id} item={item} index={idx + 1} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgendaRow({
  item,
  index,
}: {
  item: Awaited<ReturnType<typeof db.runnerAssignment.findMany>>[number] & {
    runner: { id: string; name: string } | null;
  };
  index: number;
}) {
  const date = new Date(item.eventDate);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });

  const formatTime = (d: Date | null) => {
    if (!d) return null;
    return new Date(d).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const arrivalStr = formatTime(item.arrivalTime);
  const eventStr = formatTime(item.eventTime);

  const isPast = date < new Date() && item.status !== "COMPLETED";

  return (
    <div
      className={cn(
        "flex items-start gap-4 px-5 py-4",
        isPast && item.status === "SCHEDULED" ? "opacity-60" : ""
      )}
    >
      {/* Index */}
      <span className="flex-shrink-0 w-5 text-xs text-ink-muted pt-0.5">
        {index}
      </span>

      {/* Date */}
      <div className="flex-shrink-0 w-28">
        <p className="text-xs font-semibold text-ink-primary">{dateStr}</p>
        {arrivalStr && (
          <p className="text-2xs text-ink-muted mt-0.5">
            Arrival: {arrivalStr}
          </p>
        )}
        {eventStr && (
          <p className="text-2xs text-ink-muted">
            On Air: {eventStr}
          </p>
        )}
      </div>

      {/* Venue */}
      <div className="flex-1 min-w-0">
        {item.venueName && (
          <p className="text-sm font-semibold text-ink-primary">{item.venueName}</p>
        )}
        {item.venueAddress && (
          <p className="text-xs text-ink-muted mt-0.5">{item.venueAddress}</p>
        )}
        {item.notes && (
          <p className="text-xs text-ink-secondary mt-1">{item.notes}</p>
        )}
        {item.itemType && (
          <span className="mt-1.5 inline-block rounded bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-ink-secondary">
            {item.itemType}
          </span>
        )}
      </div>

      {/* Runner (name only, no phone in client view) */}
      {item.runner && (
        <div className="flex-shrink-0 text-right">
          <p className="text-2xs text-ink-muted">PR</p>
          <p className="text-xs text-ink-secondary">{item.runner.name}</p>
        </div>
      )}

      {/* Status */}
      <span
        className={cn(
          "flex-shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-semibold",
          STATUS_STYLES[item.status] ?? "bg-surface-2 text-ink-muted"
        )}
      >
        {STATUS_LABELS[item.status] ?? item.status}
      </span>
    </div>
  );
}

function getMonthNumber(date: Date): number {
  return new Date(date).getMonth() + 1;
}
