import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthLabel } from "@/lib/utils";
import { SectionHeader } from "@/components/layout/header";
import { MyScheduleView } from "@/components/runners/my-schedule-view";
import { RunnerHoursClient } from "@/components/runners/runner-hours-client";
import {
  addDaysKey,
  currentMonthYearInTz,
  dayKeyInTz,
  monthBounds,
  tzMidnight,
} from "@/components/runners/miami-time";
import { loadScheduleItems } from "@/components/runners/load-schedule";
import { RunnerScheduleClient } from "@/components/runners/runner-schedule-client";
import { OpenPautas, type OpenPauta } from "@/components/runners/open-pautas";
import { companionWhere } from "@/lib/companions";
import { weekStartKey } from "@/components/runners/miami-time";
import {
  WeeklyAvailabilityEditor,
  type DateOverride,
  type WeeklyWindow,
} from "@/components/runners/weekly-availability-editor";
import { formatHHmm } from "@/components/runners/miami-time";

export const metadata = { title: "My Schedule — EBPR" };
export const dynamic = "force-dynamic";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export default async function RunnerPortalPage({ searchParams }: { searchParams?: { week?: string } }) {
  const user = await requireUser();

  const now = new Date();
  const todayKey = dayKeyInTz(now);
  const todayStart = tzMidnight(todayKey);

  // The whole team's week (Esther, Sept 28 2026: every runner sees everyone's pautas — Valen sees
  // Juan's, Julieta's, all). Read-only for runners; ?week= browses other weeks.
  const currentWeekKey = weekStartKey(todayKey);
  const requested = searchParams?.week;
  const weekStartDay = requested && DAY_KEY.test(requested) ? weekStartKey(requested) : currentWeekKey;
  const weekRows = await db.runnerAssignment.findMany({
    where: { eventDate: { gte: tzMidnight(weekStartDay), lt: tzMidnight(addDaysKey(weekStartDay, 7)) }, status: { not: "CANCELLED" } },
    select: {
      id: true, runnerId: true, clientId: true, eventName: true, eventDate: true, location: true, venueName: true, venueAddress: true,
      arrivalTime: true, eventTime: true, itemType: true, notes: true, status: true, autoAssigned: true,
      runner: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { eventDate: "asc" },
  });
  const weekClientIds = Array.from(new Set(weekRows.map((r) => r.clientId).filter((id): id is string => !!id)));
  const weekClientNames = new Map((weekClientIds.length ? await db.client.findMany({ where: { id: { in: weekClientIds } }, select: { id: true, name: true } }) : []).map((c) => [c.id, c.name]));
  const weekAssignments = weekRows.map(({ clientId, ...a }) => ({
    ...a,
    clientName: clientId ? weekClientNames.get(clientId) ?? null : null,
    eventDate: a.eventDate.toISOString(),
    arrivalTime: a.arrivalTime ? a.arrivalTime.toISOString() : null,
    eventTime: a.eventTime ? a.eventTime.toISOString() : null,
    dayKey: dayKeyInTz(a.eventDate),
  }));
  const teamRunners = await db.user.findMany({ where: companionWhere, select: { id: true, name: true, role: true, avatar: true }, orderBy: { name: "asc" } });
  const nextWeekKey = addDaysKey(currentWeekKey, 7);

  // Every future pauta with nobody on it (any week): what a runner could take.
  const openRows = await db.runnerAssignment.findMany({
    where: { runnerId: null, status: { in: ["SCHEDULED", "CONFIRMED"] }, eventDate: { gte: todayStart } },
    select: { id: true, eventName: true, eventDate: true, eventTime: true, arrivalTime: true, venueName: true, location: true, itemType: true, status: true, clientId: true },
    orderBy: [{ eventDate: "asc" }, { eventTime: "asc" }],
    take: 200,
  });
  const openClientIds = Array.from(new Set(openRows.map((r) => r.clientId).filter((id): id is string => !!id)));
  const openClientNames = new Map((openClientIds.length ? await db.client.findMany({ where: { id: { in: openClientIds } }, select: { id: true, name: true } }) : []).map((c) => [c.id, c.name]));
  const openPautas: OpenPauta[] = openRows.map((r) => ({
    id: r.id,
    eventName: r.eventName,
    dayKey: dayKeyInTz(r.eventDate),
    eventTime: r.eventTime ? r.eventTime.toISOString() : null,
    arrivalTime: r.arrivalTime ? r.arrivalTime.toISOString() : null,
    venueName: r.venueName,
    location: r.location,
    itemType: r.itemType,
    status: r.status,
    clientName: r.clientId ? openClientNames.get(r.clientId) ?? null : null,
  }));

  // Only this runner's own assignments. Today's events stay visible for the
  // whole day (and uncompleted ones for a week after) so the runner can mark
  // them completed with post-event notes.
  const assignments = await loadScheduleItems({
    runnerId: user.id,
    OR: [
      { eventDate: { gte: todayStart } },
      {
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        eventDate: { gte: tzMidnight(addDaysKey(todayKey, -7)) },
      },
    ],
    status: { not: "CANCELLED" },
  });

  // The runner's own availability — this is what the auto-scheduler reads.
  const [weeklyRows, overrideRows] = await Promise.all([
    db.runnerWeeklyAvailability.findMany({
      where: { userId: user.id },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
      select: { dayOfWeek: true, startMinute: true, endMinute: true },
    }),
    db.runnerAvailability.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
      select: { id: true, date: true, isAvailable: true, notes: true },
    }),
  ]);
  const weeklyWindows: WeeklyWindow[] = weeklyRows.map((r) => ({
    dayOfWeek: r.dayOfWeek,
    start: formatHHmm(r.startMinute),
    end: formatHHmm(r.endMinute),
  }));
  const dateOverrides: DateOverride[] = overrideRows.map((r) => ({
    id: r.id,
    date: dayKeyInTz(r.date),
    isAvailable: r.isAvailable,
    notes: r.notes,
  }));

  // Current month's hours (month boundaries in Miami time)
  const { month, year } = currentMonthYearInTz(now);
  const hoursThisMonth = await db.runnerHours.findMany({
    where: { runnerId: user.id, date: monthBounds(year, month) },
    orderBy: { date: "desc" },
    select: { id: true, date: true, hours: true, description: true, clientName: true },
  });

  // Decimal -> number, Date -> string before handing to the client component
  const hours = hoursThisMonth.map((h) => ({
    id: h.id,
    date: h.date.toISOString(),
    dayKey: dayKeyInTz(h.date),
    hours: Number(h.hours),
    description: h.description,
    clientName: h.clientName,
  }));
  const totalHours = Math.round(hours.reduce((sum, h) => sum + h.hours, 0) * 100) / 100;
  const upcomingCount = assignments.filter(
    (a) => a.status === "SCHEDULED" || a.status === "CONFIRMED"
  ).length;

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-1">{monthLabel(month, year)}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-primary">My Schedule</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Welcome, {user.name.split(" ")[0]} &middot;{" "}
          <span className="tabular">{upcomingCount}</span> upcoming assignment
          {upcomingCount === 1 ? "" : "s"}
        </p>
      </header>

      {/* The team's full week, exactly like the internal Runner Schedule (read-only for runners) */}
      <section className="space-y-4">
        <RunnerScheduleClient
          assignments={weekAssignments}
          runners={teamRunners}
          clients={[]}
          weekStartKey={weekStartDay}
          currentWeekKey={currentWeekKey}
          nextWeekKey={nextWeekKey}
          nextWeekEndKey={addDaysKey(nextWeekKey, 6)}
          todayKey={todayKey}
          isRunner
          embedded
          basePath="/runner-portal"
        />
      </section>

      {/* Everything upcoming that still needs a runner — take it from here */}
      <section className="space-y-4">
        <SectionHeader
          title="Pautas that need a runner"
          description={openPautas.length ? `${openPautas.length} upcoming pauta${openPautas.length === 1 ? "" : "s"} nobody is on yet. If one fits your schedule, take it.` : "Upcoming pautas nobody is on yet."}
          className="mb-0"
        />
        <OpenPautas pautas={openPautas} />
      </section>

      {/* Own pautas with actions (mark complete / can't attend) */}
      <section className="space-y-4">
        <SectionHeader title="My assignments" description="Only yours: mark them complete or step down if you can't make it." className="mb-0" />
        <MyScheduleView assignments={assignments} todayKey={todayKey} />
      </section>

      {/* Hours tracking */}
      <RunnerHoursClient hours={hours} totalHours={totalHours} todayKey={todayKey} />

      {/* Availability — the schedule is built from this */}
      <section className="space-y-4">
        <SectionHeader
          title="My availability"
          description="The weekly schedule is built from these hours. Keep them up to date."
          className="mb-0"
        />
        <WeeklyAvailabilityEditor
          userId={user.id}
          title="My weekly hours"
          initialWindows={weeklyWindows}
          initialOverrides={dateOverrides}
        />
      </section>

    </div>
  );
}
