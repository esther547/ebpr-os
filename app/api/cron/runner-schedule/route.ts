import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, NO_STORE } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { autoAssignRunners, nextWeekRange } from "@/lib/runner-assign";
import { formatDayKey } from "@/components/runners/miami-time";

/**
 * Friday schedule build — what the team used to do by hand every Friday.
 *
 * Runs the assignment engine over next Monday..Sunday (Miami) and tells
 * SUPER_ADMIN / STRATEGIST how it went. Only activities with no runner yet are
 * touched, so a hand-picked runner is never overwritten, and re-running the job
 * is harmless (already-assigned activities simply fall out of the query).
 *
 * vercel.json schedules it at "0 13 * * 5" — 13:00 UTC on Friday, which is
 * 9am Miami during EDT (summer) and 8am Miami during EST (winter). Vercel cron
 * expressions are always UTC, so the hour cannot follow US daylight saving.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await authorizeCron(req);
  if (denied) return denied;

  const { from, to } = nextWeekRange();

  let report;
  try {
    report = await autoAssignRunners({ from, to, onlyUnassigned: true });
  } catch (err) {
    console.error("GET /api/cron/runner-schedule failed:", err);
    return NextResponse.json(
      { error: "Could not build next week's schedule" },
      { status: 500, headers: NO_STORE }
    );
  }

  const total = report.assigned.length + report.unassigned.length;
  const summary =
    total === 0
      ? `Next week (${formatDayKey(from, "MMM d")}–${formatDayKey(to, "MMM d")}): no activities scheduled yet`
      : `Next week: ${total} ${total === 1 ? "activity" : "activities"}, ${report.assigned.length} assigned, ${report.unassigned.length} need a runner`;

  const team = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "STRATEGIST"] }, isActive: true },
    select: { id: true },
  });

  // One notification per weekly run: the link carries the week, so re-running
  // the job on the same Friday does not pile up duplicates.
  const link = `/runners/schedule?week=${from}`;
  let notified = 0;
  for (const member of team) {
    const existing = await db.notification.findFirst({
      where: { userId: member.id, type: "runner_schedule_built", link },
      select: { id: true },
    });
    if (existing) continue;
    await db.notification.create({
      data: {
        userId: member.id,
        title: "Next week's runner schedule",
        message: summary,
        type: "runner_schedule_built",
        link,
      },
    });
    notified++;
  }

  return NextResponse.json(
    {
      message: "Runner schedule cron completed",
      timestamp: new Date().toISOString(),
      week: { from, to },
      summary,
      notified,
      results: {
        total,
        assigned: report.assigned.length,
        needsRunner: report.unassigned.length,
      },
      report,
    },
    { headers: NO_STORE }
  );
}
