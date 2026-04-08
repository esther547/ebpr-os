import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MyScheduleView } from "@/components/runners/my-schedule-view";

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

  const upcomingCount = assignments.filter(
    (a) => a.status === "SCHEDULED" || a.status === "CONFIRMED"
  ).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink-primary">My Schedule</h1>
        <p className="text-sm text-ink-muted mt-1">
          Welcome, {user.name} · {upcomingCount} upcoming assignment{upcomingCount !== 1 ? "s" : ""}
        </p>
      </div>
      <MyScheduleView assignments={JSON.parse(JSON.stringify(assignments))} />
    </div>
  );
}
