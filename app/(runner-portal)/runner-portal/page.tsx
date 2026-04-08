import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MyScheduleView } from "@/components/runners/my-schedule-view";
import { RunnerHoursClient } from "@/components/runners/runner-hours-client";

export const metadata = { title: "My Schedule — EBPR" };
export const dynamic = "force-dynamic";

export default async function RunnerPortalPage() {
  const user = await requireUser();

  const assignments = await db.runnerAssignment.findMany({
    where: {
      runnerId: user.id,
      eventDate: { gte: new Date() },
      status: { not: "CANCELLED" },
    },
    orderBy: { eventDate: "asc" },
    take: 50,
    include: {
      runner: { select: { id: true, name: true } },
    },
  });

  // Get current month hours
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const hoursThisMonth = await db.runnerHours.findMany({
    where: {
      runnerId: user.id,
      date: { gte: monthStart, lte: monthEnd },
    },
    orderBy: { date: "desc" },
  });

  const totalHours = hoursThisMonth.reduce((sum, h) => sum + Number(h.hours), 0);
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
      <RunnerHoursClient
        hours={JSON.parse(JSON.stringify(hoursThisMonth))}
        totalHours={totalHours}
      />

      {/* Schedule */}
      <div className="mt-8">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Upcoming Assignments
        </h2>
        <MyScheduleView assignments={JSON.parse(JSON.stringify(assignments))} />
      </div>
    </div>
  );
}
