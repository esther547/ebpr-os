import { requireUser } from "@/lib/auth";
import { canViewRunnerSchedule } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/header";
import { MyScheduleView } from "@/components/runners/my-schedule-view";
import { EmptyState } from "@/components/ui/empty-state";
import { Lock } from "lucide-react";
import { addDaysKey, dayKeyInTz, tzMidnight } from "@/components/runners/miami-time";
import { loadScheduleItems } from "@/components/runners/load-schedule";

export const metadata = { title: "My Schedule" };
export const dynamic = "force-dynamic";

export default async function MySchedulePage() {
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

  // Runners see only their own; admins see all
  const runnerId = user.role === "RUNNER" ? user.id : undefined;

  const todayKey = dayKeyInTz(new Date());
  const assignments = await loadScheduleItems({
    ...(runnerId ? { runnerId } : {}),
    // From the start of today (Miami), plus uncompleted events from the past week
    OR: [
      { eventDate: { gte: tzMidnight(todayKey) } },
      {
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        eventDate: { gte: tzMidnight(addDaysKey(todayKey, -7)) },
      },
    ],
    status: { not: "CANCELLED" },
  });

  const upcomingCount = assignments.filter((a) => a.status === "SCHEDULED" || a.status === "CONFIRMED").length;

  return (
    <>
      <PageHeader
        title="My Schedule"
        subtitle={`${upcomingCount} upcoming assignment${upcomingCount === 1 ? "" : "s"}`}
      />
      <div className="space-y-6">
        <MyScheduleView assignments={assignments} todayKey={todayKey} showRunner={!runnerId} />
      </div>
    </>
  );
}
