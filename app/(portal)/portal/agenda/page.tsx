import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { allocateAgendaMonths } from "@/lib/agenda-months";

export const metadata = { title: "My Agenda" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Goal",
  CONFIRMED: "Confirmed",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

const STATUS_TONES: Record<string, BadgeTone> = {
  SCHEDULED: "neutral",
  CONFIRMED: "success",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function PortalAgendaPage() {
  const clientUser = await getCurrentClientUser();
  if (!clientUser) redirect("/sign-in");
  if (!clientUser.isActive) redirect("/access-pending");

  const [client, items] = await Promise.all([
    db.client.findUnique({
      where: { id: clientUser.clientId },
      select: { monthlyTarget: true, cycleDay: true },
    }),
    db.runnerAssignment.findMany({
      where: { clientId: clientUser.clientId },
      orderBy: [{ eventDate: "asc" }],
      include: {
        runner: { select: { id: true, name: true } },
      },
    }),
  ]);

  // Report months: MES 1 = the first `monthlyTarget` goals, MES 2 the next… (lib/agenda-months.ts)
  const months = allocateAgendaMonths(items, {
    monthlyTarget: client?.monthlyTarget ?? 0,
    cycleDay: client?.cycleDay ?? null,
  });

  const upcomingCount = items.filter(
    (i) =>
      i.status === "SCHEDULED" ||
      i.status === "CONFIRMED"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        className="pt-0 pb-0 sm:pt-0"
        title="My Agenda"
        subtitle={
          upcomingCount > 0
            ? `${upcomingCount} upcoming appearance${upcomingCount !== 1 ? "s" : ""}`
            : "Your schedule for this year"
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No agenda yet"
          description="Your upcoming appearances will appear here once scheduled."
        />
      ) : (
        <div className="space-y-6">
          {months.map((m) => (
            <section key={m.monthNumber}>
              <SectionHeader
                title={`MES ${m.monthNumber} — ${MONTH_NAMES[m.month].toUpperCase()} ${m.year}`}
              />
              <Card padding="none" className="divide-y divide-border">
                {m.items.map((item, idx) => (
                  <AgendaRow key={item.id} item={item} index={idx + 1} />
                ))}
              </Card>
            </section>
          ))}
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
        "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:gap-4",
        isPast && item.status === "SCHEDULED" ? "opacity-60" : ""
      )}
    >
      {/* Index + date */}
      <div className="flex shrink-0 items-start gap-3 sm:w-36">
        <span className="w-5 pt-0.5 text-xs text-ink-muted tabular">{index}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-primary tabular">{dateStr}</p>
          {arrivalStr && (
            <p className="mt-0.5 text-2xs text-ink-muted">Arrival: {arrivalStr}</p>
          )}
          {eventStr && (
            <p className="text-2xs text-ink-muted">On Air: {eventStr}</p>
          )}
        </div>
      </div>

      {/* Venue */}
      <div className="min-w-0 flex-1 sm:pl-0 pl-8">
        {item.venueName && (
          <p className="text-sm font-semibold text-ink-primary">{item.venueName}</p>
        )}
        {item.venueAddress && (
          <p className="mt-0.5 text-xs text-ink-muted">{item.venueAddress}</p>
        )}
        {item.notes && (
          <p className="mt-1 max-w-prose text-xs text-ink-secondary">{item.notes}</p>
        )}
        {item.itemType && (
          <Badge tone="outline" size="xs" className="mt-1.5">
            {item.itemType}
          </Badge>
        )}
      </div>

      {/* Runner (name only, no phone in client view) + status */}
      <div className="flex shrink-0 items-center justify-between gap-4 pl-8 sm:justify-end sm:pl-0">
        {item.runner && (
          <div className="sm:text-right">
            <p className="eyebrow">PR</p>
            <p className="text-xs text-ink-secondary">{item.runner.name}</p>
          </div>
        )}
        <Badge tone={STATUS_TONES[item.status] ?? "neutral"} dot className="shrink-0">
          {STATUS_LABELS[item.status] ?? item.status}
        </Badge>
      </div>
    </div>
  );
}

