import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
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

export const metadata = { title: "My Schedule — EBPR" };
export const dynamic = "force-dynamic";

export default async function RunnerPortalPage() {
  const user = await requireUser();

  const now = new Date();
  const todayKey = dayKeyInTz(now);
  const todayStart = tzMidnight(todayKey);

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
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink-primary">My Schedule</h1>
        <p className="text-sm text-ink-muted mt-1">
          Welcome, {user.name} · {upcomingCount} upcoming · {totalHours}h this month
        </p>
      </div>

      {/* Hours Tracking */}
      <RunnerHoursClient hours={hours} totalHours={totalHours} todayKey={todayKey} />

      {/* Schedule */}
      <div className="mt-8">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Upcoming Assignments
        </h2>
        <MyScheduleView assignments={assignments} todayKey={todayKey} />
      </div>
    </div>
  );
}
