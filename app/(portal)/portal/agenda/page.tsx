import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientSafeNotes } from "@/lib/client-safe-notes";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { periodBoard } from "@/lib/service-periods";

export const metadata = { title: "My Agenda" };
export const dynamic = "force-dynamic";

const UNIT_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  closed_pending: "Confirmed · pending execution",
  executed: "Executed",
  cancelled: "Cancelled",
};
const UNIT_TONES: Record<string, BadgeTone> = { scheduled: "neutral", closed_pending: "warning", executed: "success", cancelled: "danger" };

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
  // Service periods — the same grouping, progress and states the team sees.
  const board = await periodBoard(clientUser.clientId);
  const unitByPauta = new Map(board.periods.flatMap((pp) => pp.units).concat(board.pending).filter((u) => u.pautaId).map((u) => [u.pautaId!, u]));
  const periods = board.periods.map((pp) => ({
    ...pp,
    pautas: items.filter((it) => unitByPauta.get(it.id)?.periodId === pp.id),
    goalOnly: pp.units.filter((u) => !u.pautaId),
  }));

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

      {periods.length === 0 && items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No agenda yet"
          description="Your upcoming appearances will appear here once scheduled."
        />
      ) : (
        <div className="space-y-6">
          {periods.map((m) => {
            const done = m.target > 0 && m.achieved >= m.target;
            return (
              <section key={m.id}>
                <SectionHeader
                  title={`MONTH ${m.number} — ${m.label.toUpperCase()}`}
                  description={`${m.target > 0 ? `${m.target} goals agreed` : ""}${m.closedPending ? ` · ${m.closedPending} confirmed, pending execution` : ""}${m.executed ? ` · ${m.executed} executed` : ""}`}
                  actions={<span className={cn("tabular text-sm font-semibold", done ? "text-emerald-700" : "text-ink-primary")}>{m.achieved}{m.target > 0 ? ` / ${m.target}` : ""}</span>}
                />
                {m.pautas.length === 0 && m.goalOnly.length === 0 ? (
                  <p className="text-sm text-ink-muted">No activities in this period yet.</p>
                ) : (
                  <Card padding="none" className="divide-y divide-border">
                    {m.pautas.map((item, idx) => (
                      <AgendaRow key={item.id} item={item} index={idx + 1} unit={unitByPauta.get(item.id)} />
                    ))}
                    {m.goalOnly.map((u, idx) => (
                      <div key={u.key} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <span className="w-5 text-xs text-ink-muted tabular">{m.pautas.length + idx + 1}</span>
                        <p className="min-w-0 flex-1 text-sm font-medium text-ink-primary">{u.title}</p>
                        {u.coversPeriod && <Badge tone="purple" size="xs">Covers the full month</Badge>}
                        <Badge tone={UNIT_TONES[u.state]} dot>{UNIT_LABELS[u.state]}</Badge>
                      </div>
                    ))}
                  </Card>
                )}
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
  unit,
}: {
  unit?: { state: string; coversPeriod: boolean };
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
        {clientSafeNotes(item.notes) && (
          <p className="mt-1 max-w-prose text-xs text-ink-secondary">{clientSafeNotes(item.notes)}</p>
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
        <div className="flex shrink-0 flex-col items-end gap-1">
          {unit?.coversPeriod && <Badge tone="purple" size="xs">Covers the full month</Badge>}
          <Badge tone={unit ? UNIT_TONES[unit.state] : STATUS_TONES[item.status] ?? "neutral"} dot className="shrink-0">
            {unit ? UNIT_LABELS[unit.state] : STATUS_LABELS[item.status] ?? item.status}
          </Badge>
        </div>
      </div>
    </div>
  );
}

