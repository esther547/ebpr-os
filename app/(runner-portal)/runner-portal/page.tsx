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

      {/* Hours tracking */}
      <RunnerHoursClient hours={hours} totalHours={totalHours} todayKey={todayKey} />

      {/* Schedule */}
      <section className="space-y-4">
        <SectionHeader title="Upcoming assignments" className="mb-0" />
        <MyScheduleView assignments={assignments} todayKey={todayKey} />
      </section>
    </div>
  );
}
