import { requireUser } from "@/lib/auth";
import { canViewRunnerSchedule } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { MyScheduleView } from "@/components/runners/my-schedule-view";

export const metadata = { title: "My Schedule" };
export const dynamic = "force-dynamic";

export default async function MySchedulePage() {
  const user = await requireUser();
  if (!canViewRunnerSchedule(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  // Runners see only their own; admins see all
  const runnerId = user.role === "RUNNER" ? user.id : undefined;

  const assignments = await db.runnerAssignment.findMany({
    where: {
      ...(runnerId ? { runnerId } : {}),
      eventDate: { gte: new Date() },
      status: { not: "CANCELLED" },
    },
    orderBy: { eventDate: "asc" },
    take: 50,
    include: {
      runner: { select: { id: true, name: true } },
    },
  });

  const upcomingCount = assignments.filter((a) => a.status === "SCHEDULED" || a.status === "CONFIRMED").length;

  return (
    <>
      <PageHeader
        title="My Schedule"
        subtitle={`${upcomingCount} upcoming assignments`}
      />
      <MyScheduleView assignments={JSON.parse(JSON.stringify(assignments))} />
    </>
  );
}
