import Link from "next/link";
import { CalendarX2, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canManageRunners } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/form-field";
import {
  WeeklyAvailabilityEditor,
  type DateOverride,
  type WeeklyWindow,
} from "@/components/runners/weekly-availability-editor";
import { dayKeyInTz, formatHHmm } from "@/components/runners/miami-time";

export const metadata = { title: "Runner Availability" };
export const dynamic = "force-dynamic";

export default async function RunnerAvailabilityPage() {
  const user = await requireUser();
  if (!canManageRunners(user)) {
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

  const runners = await db.user.findMany({
    where: { role: "RUNNER", isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const runnerIds = runners.map((r) => r.id);
  const [weeklyRows, overrideRows] = await Promise.all([
    runnerIds.length
      ? db.runnerWeeklyAvailability.findMany({
          where: { userId: { in: runnerIds } },
          orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
          select: { userId: true, dayOfWeek: true, startMinute: true, endMinute: true },
        })
      : Promise.resolve([]),
    runnerIds.length
      ? db.runnerAvailability.findMany({
          where: { userId: { in: runnerIds } },
          orderBy: { date: "asc" },
          select: { id: true, userId: true, date: true, isAvailable: true, notes: true },
        })
      : Promise.resolve([]),
  ]);

  const windowsByUser = new Map<string, WeeklyWindow[]>();
  for (const r of weeklyRows) {
    const arr = windowsByUser.get(r.userId) ?? [];
    arr.push({
      dayOfWeek: r.dayOfWeek,
      start: formatHHmm(r.startMinute),
      end: formatHHmm(r.endMinute),
    });
    windowsByUser.set(r.userId, arr);
  }

  const overridesByUser = new Map<string, DateOverride[]>();
  for (const r of overrideRows) {
    const arr = overridesByUser.get(r.userId) ?? [];
    arr.push({
      id: r.id,
      date: dayKeyInTz(r.date),
      isAvailable: r.isAvailable,
      notes: r.notes,
    });
    overridesByUser.set(r.userId, arr);
  }

  const withoutAvailability = runners.filter((r) => !windowsByUser.has(r.id)).length;

  return (
    <>
      <PageHeader
        title="Runner Availability"
        subtitle={
          withoutAvailability > 0
            ? `${runners.length} runners · ${withoutAvailability} with no availability set (never auto-assigned)`
            : `${runners.length} runners`
        }
        breadcrumbs={[{ label: "Runners", href: "/runners/schedule" }, { label: "Availability" }]}
        actions={
          <Button asChild variant="secondary">
            <Link href="/runners/schedule">Back to schedule</Link>
          </Button>
        }
      />

      {runners.length === 0 ? (
        <EmptyState
          icon={<CalendarX2 />}
          title="No runners yet"
          description="Add a runner in Settings before setting availability."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {runners.map((r) => (
            <WeeklyAvailabilityEditor
              key={r.id}
              userId={r.id}
              title={r.name}
              initialWindows={windowsByUser.get(r.id) ?? []}
              initialOverrides={overridesByUser.get(r.id) ?? []}
            />
          ))}
        </div>
      )}
    </>
  );
}
