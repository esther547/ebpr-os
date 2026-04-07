import { requireUser } from "@/lib/auth";
import { canViewRunnerSchedule } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { RunnerScheduleView } from "@/components/runners/runner-schedule-view";
import { startOfWeek, endOfWeek, addWeeks } from "date-fns";

export const metadata = { title: "Runner Schedule" };
export const dynamic = "force-dynamic";

export default async function RunnerSchedulePage() {
  const user = await requireUser();
  if (!canViewRunnerSchedule(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  // For runners: only their assignments. For others: all.
  const where =
    user.role === "RUNNER"
      ? { runnerId: user.id, eventDate: { gte: weekStart, lte: weekEnd } }
      : { eventDate: { gte: weekStart, lte: weekEnd } };

  const assignments = await db.runnerAssignment.findMany({
    where,
    include: {
      runner: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { eventDate: "asc" },
  });

  const runners = await db.user.findMany({
    where: { role: "RUNNER", isActive: true },
    select: { id: true, name: true, avatar: true },
  });

  return (
    <>
      <PageHeader
        title="Runner Schedule"
        subtitle="Weekly assignments"
        actions={
          user.role !== "RUNNER" ? (
            <button className="inline-flex h-9 items-center rounded-md bg-ink-primary px-4 text-sm font-medium text-ink-inverted hover:bg-ink-primary/90 transition-colors">
              + Assign Runner
            </button>
          ) : undefined
        }
      />
      <RunnerScheduleView
        assignments={assignments}
        runners={runners}
        weekStart={weekStart}
        isReadOnly={user.role === "RUNNER"}
      />
    </>
  );
}
