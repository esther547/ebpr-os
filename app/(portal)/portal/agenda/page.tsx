import { redirect } from "next/navigation";
import Link from "next/link";
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

export default async function PortalAgendaPage({ searchParams }: { searchParams?: { view?: string } }) {
  const view = searchParams?.view === "calendar" ? "calendar" : "periods";
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

  // Calendar view: the same pautas grouped by the month they actually happen (upcoming months first).
  const byMonth = new Map<string, typeof items>();
  for (const it of items.filter((i) => i.status !== "CANCELLED")) {
    const d = new Date(it.eventDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, [...(byMonth.get(key) ?? []), it]);
  }
  const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const keys = [...byMonth.keys()].sort();
  const calendarMonths = [...keys.filter((k) => k >= nowKey), ...keys.filter((k) => k < nowKey).reverse()].map((key) => {
    const [y, mo] = key.split("-").map(Number);
    return { key, title: `${MONTH_NAMES[mo].toUpperCase()} ${y}${key === nowKey ? " · THIS MONTH" : ""}`, items: byMonth.get(key)! };
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

      {/* Two views of the same records: what was achieved for each month you pay, and when each thing happens. */}
      <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
        <Link href="/portal/agenda" className={cn("rounded-md px-3 py-1.5 text-xs font-medium", view === "periods" ? "bg-ink-primary text-white" : "text-ink-secondary")}>By service month</Link>
        <Link href="/portal/agenda?view=calendar" className={cn("rounded-md px-3 py-1.5 text-xs font-medium", view === "calendar" ? "bg-ink-primary text-white" : "text-ink-secondary")}>By date</Link>
      </div>
      <p className="text-xs text-ink-muted">
        {view === "periods"
          ? "Each service month lists what we secured for you during it, whatever the date of the event."
          : "Your calendar: every activity on the date it actually happens."}
      </p>

      {view === "calendar" ? (
        calendarMonths.length === 0 ? (
          <EmptyState icon={<CalendarDays />} title="No agenda yet" description="Your upcoming appearances will appear here once scheduled." />
        ) : (
          <div className="space-y-6">
            {calendarMonths.map((cm) => (
              <section key={cm.key}>
                <SectionHeader title={cm.title} actions={<span className="text-xs text-ink-muted">{cm.items.length} {cm.items.length === 1 ? "activity" : "activities"}</span>} />
                <Card padding="none" className="divide-y divide-border">
                  {cm.items.map((item, idx) => (
                    <AgendaRow key={item.id} item={item} index={idx + 1} unit={unitByPauta.get(item.id)} />
                  ))}
                </Card>
              </section>
            ))}
          </div>
        )
      ) : periods.length === 0 && items.length === 0 ? (
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
                  description={`${m.target > 0 ? `${m.target} goals agreed · ` : ""}${m.pautas.length + m.goalOnly.length} secured${m.closedPending ? ` · ${m.closedPending} confirmed, pending execution` : ""}${m.executed ? ` · ${m.executed} executed` : ""}`}
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
                        {u.isGold && <span className="inline-flex items-center rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold tracking-wide text-white">GOLD</span>}
                        {u.coversPeriod && <Badge tone="purple" size="xs">Covers the full month</Badge>}
                        {!u.coversPeriod && u.goalValue > 1 && <Badge tone="purple" size="xs">Counts as {u.goalValue} goals</Badge>}
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
  unit?: { state: string; coversPeriod: boolean; goalValue: number; isGold?: boolean };
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
          {unit?.isGold && <span className="inline-flex items-center rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold tracking-wide text-white">GOLD</span>}
          {unit?.coversPeriod && <Badge tone="purple" size="xs">Covers the full month</Badge>}
          {unit && !unit.coversPeriod && unit.goalValue > 1 && <Badge tone="purple" size="xs">Counts as {unit.goalValue} goals</Badge>}
          <Badge tone={unit ? UNIT_TONES[unit.state] : STATUS_TONES[item.status] ?? "neutral"} dot className="shrink-0">
            {unit ? UNIT_LABELS[unit.state] : STATUS_LABELS[item.status] ?? item.status}
          </Badge>
        </div>
      </div>
    </div>
  );
}

