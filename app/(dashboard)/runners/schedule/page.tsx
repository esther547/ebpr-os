import { requireUser } from "@/lib/auth";
import { canViewRunnerSchedule } from "@/lib/permissions";
import { db } from "@/lib/db";
import { RunnerScheduleClient } from "@/components/runners/runner-schedule-client";
import {
  addDaysKey,
  dayKeyInTz,
  tzMidnight,
  weekStartKey,
} from "@/components/runners/miami-time";

export const metadata = { title: "Runner Schedule" };
export const dynamic = "force-dynamic";

export default async function RunnerSchedulePage() {
  const user = await requireUser();
  if (!canViewRunnerSchedule(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  // Week boundaries in Miami time (weeks start Monday), independent of server TZ.
  const todayKey = dayKeyInTz(new Date());
  const weekStartDay = weekStartKey(todayKey);
  const weekStart = tzMidnight(weekStartDay);
  const weekEnd = tzMidnight(addDaysKey(weekStartDay, 7)); // exclusive

  const where =
    user.role === "RUNNER"
      ? { runnerId: user.id, eventDate: { gte: weekStart, lt: weekEnd } }
      : { eventDate: { gte: weekStart, lt: weekEnd } };

  const rows = await db.runnerAssignment.findMany({
    where,
    select: {
      id: true,
      runnerId: true,
      eventName: true,
      eventDate: true,
      location: true,
      venueName: true,
      status: true,
      runner: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { eventDate: "asc" },
  });

  const assignments = rows.map((a) => ({
    ...a,
    eventDate: a.eventDate.toISOString(),
    dayKey: dayKeyInTz(a.eventDate),
  }));

  const runners = await db.user.findMany({
    where: { role: "RUNNER", isActive: true },
    select: { id: true, name: true, avatar: true },
  });

  const clients = await db.client.findMany({
    where: { status: { in: ["ACTIVE", "PROSPECT"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <RunnerScheduleClient
      assignments={assignments}
      runners={runners}
      clients={clients}
      weekStartKey={weekStartDay}
      todayKey={todayKey}
      isRunner={user.role === "RUNNER"}
    />
  );
}
