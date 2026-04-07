import { requireUser } from "@/lib/auth";
import { canViewRunnerSchedule } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { RunnerScheduleClient } from "@/components/runners/runner-schedule-client";
import { startOfWeek, endOfWeek } from "date-fns";

export const metadata = { title: "Runner Schedule" };
export const dynamic = "force-dynamic";

export default async function RunnerSchedulePage() {
  const user = await requireUser();
  if (!canViewRunnerSchedule(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

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

  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <RunnerScheduleClient
      assignments={JSON.parse(JSON.stringify(assignments))}
      runners={runners}
      clients={clients}
      weekStart={JSON.parse(JSON.stringify(weekStart))}
      isRunner={user.role === "RUNNER"}
    />
  );
}
