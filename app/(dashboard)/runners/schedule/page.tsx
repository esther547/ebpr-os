import { requireUser } from "@/lib/auth";
import { canViewRunnerSchedule } from "@/lib/permissions";
import { db } from "@/lib/db";
import { companionWhere } from "@/lib/companions";
import { RunnerScheduleClient } from "@/components/runners/runner-schedule-client";
import { EmptyState } from "@/components/ui/empty-state";
import { Lock } from "lucide-react";
import {
  addDaysKey,
  dayKeyInTz,
  tzMidnight,
  weekStartKey,
} from "@/components/runners/miami-time";

export const metadata = { title: "Runner Schedule" };
export const dynamic = "force-dynamic";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export default async function RunnerSchedulePage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const user = await requireUser();
  if (!canViewRunnerSchedule(user)) {
    return (
      <div className="py-16">
        <EmptyState
          icon={<Lock />}
          title="Access restricted"
          description="You do not have permission to view this page."
        />
      </div>
    );
  }

  // Week boundaries in Miami time (weeks start Monday), independent of server TZ.
  // ?week=yyyy-MM-dd navigates to any other week; the value is snapped to Monday.
  const todayKey = dayKeyInTz(new Date());
  const currentWeekKey = weekStartKey(todayKey);
  const requested = searchParams?.week;
  const weekStartDay =
    requested && DAY_KEY.test(requested) ? weekStartKey(requested) : currentWeekKey;
  const weekStart = tzMidnight(weekStartDay);
  const weekEnd = tzMidnight(addDaysKey(weekStartDay, 7)); // exclusive

  const where =
    user.role === "RUNNER"
      ? { runnerId: user.id, eventDate: { gte: weekStart, lt: weekEnd } }
      : { eventDate: { gte: weekStart, lt: weekEnd } };

  const scheduleSelect = {
      id: true,
      runnerId: true,
      clientId: true,
      eventName: true,
      eventDate: true,
      location: true,
      venueName: true,
      venueAddress: true,
      arrivalTime: true,
      eventTime: true,
      itemType: true,
      notes: true,
      status: true,
      autoAssigned: true,
      runner: { select: { id: true, name: true, avatar: true } },
  } as const;
  const rows = await db.runnerAssignment.findMany({ where, select: scheduleSelect, orderBy: { eventDate: "asc" } });
  // Every future pauta with nobody on it (any week) — shown under the week so the team can assign.
  const openRows = await db.runnerAssignment.findMany({
    where: { runnerId: null, status: { in: ["SCHEDULED", "CONFIRMED"] }, eventDate: { gte: tzMidnight(todayKey) } },
    select: scheduleSelect,
    orderBy: [{ eventDate: "asc" }, { eventTime: "asc" }],
    take: 200,
  });

  const clientIds = Array.from(new Set([...rows, ...openRows].map((r) => r.clientId).filter((id): id is string => !!id)));
  const clientNames = new Map(
    (clientIds.length
      ? await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
      : []
    ).map((c) => [c.id, c.name])
  );

  const toAssignment = ({ clientId, ...a }: (typeof rows)[number]) => ({
    ...a,
    clientName: clientId ? clientNames.get(clientId) ?? null : null,
    eventDate: a.eventDate.toISOString(),
    arrivalTime: a.arrivalTime ? a.arrivalTime.toISOString() : null,
    eventTime: a.eventTime ? a.eventTime.toISOString() : null,
    dayKey: dayKeyInTz(a.eventDate),
  });
  const assignments = rows.map(toAssignment);
  const openPautas = openRows.map(toAssignment);

  const runners = await db.user.findMany({
    where: companionWhere,
    select: { id: true, name: true, role: true, avatar: true },
    orderBy: { name: "asc" },
  });

  const clients = await db.client.findMany({
    where: { status: { in: ["ACTIVE", "PROSPECT"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const nextWeekKey = addDaysKey(currentWeekKey, 7);

  return (
    <RunnerScheduleClient
      assignments={assignments}
      runners={runners}
      clients={clients}
      weekStartKey={weekStartDay}
      currentWeekKey={currentWeekKey}
      nextWeekKey={nextWeekKey}
      nextWeekEndKey={addDaysKey(nextWeekKey, 6)}
      todayKey={todayKey}
      isRunner={user.role === "RUNNER"}
      openPautas={openPautas}
    />
  );
}
