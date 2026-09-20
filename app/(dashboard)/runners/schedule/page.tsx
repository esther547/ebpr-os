import { requireUser } from "@/lib/auth";
import { canViewRunnerSchedule } from "@/lib/permissions";
import { db } from "@/lib/db";
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
      autoAssigned: true,
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
    />
  );
}
