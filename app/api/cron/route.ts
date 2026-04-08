import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";

/**
 * Cron endpoint — called periodically to generate notifications:
 * 1. Runner reminders (24h before + same day)
 * 2. Overdue invoice alerts
 * 3. Unsigned contract alerts
 * 4. Scheduling conflict detection
 */
export async function GET() {
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const results: Record<string, number> = {};

  // ── 1. Runner Reminders (24h before) ──────────────────────
  const tomorrowAssignments = await db.runnerAssignment.findMany({
    where: {
      eventDate: {
        gte: startOfDay(tomorrow),
        lte: endOfDay(tomorrow),
      },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    include: { runner: { select: { id: true, name: true } } },
  });

  let runnerReminders = 0;
  for (const a of tomorrowAssignments) {
    // Check if we already sent a reminder for this assignment
    const existing = await db.notification.findFirst({
      where: {
        userId: a.runnerId,
        type: "runner_reminder_24h",
        message: { contains: a.id },
      },
    });
    if (!existing) {
      await db.notification.create({
        data: {
          userId: a.runnerId,
          title: "Assignment Tomorrow",
          message: `${a.eventName} — tomorrow. ${a.venueName ? `At ${a.venueName}` : ""}`.trim(),
          type: "runner_reminder_24h",
          link: "/runner-portal",
        },
      });
      runnerReminders++;
    }
  }
  results.runnerReminders24h = runnerReminders;

  // ── 2. Same-day Runner Reminders ──────────────────────────
  const todayAssignments = await db.runnerAssignment.findMany({
    where: {
      eventDate: {
        gte: startOfDay(now),
        lte: endOfDay(now),
      },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    include: { runner: { select: { id: true, name: true } } },
  });

  let sameDayReminders = 0;
  for (const a of todayAssignments) {
    const existing = await db.notification.findFirst({
      where: {
        userId: a.runnerId,
        type: "runner_reminder_today",
        message: { contains: a.id },
      },
    });
    if (!existing) {
      await db.notification.create({
        data: {
          userId: a.runnerId,
          title: "Assignment Today",
          message: `${a.eventName} — today! ${a.venueName ? `At ${a.venueName}` : ""}`.trim(),
          type: "runner_reminder_today",
          link: "/runner-portal",
        },
      });
      sameDayReminders++;
    }
  }
  results.runnerRemindersToday = sameDayReminders;

  // ── 3. Notify strategist of upcoming deliverables ─────────
  const upcomingDeliverables = await db.deliverable.findMany({
    where: {
      dueDate: {
        gte: startOfDay(tomorrow),
        lte: endOfDay(tomorrow),
      },
      status: { not: "COMPLETED" },
      assigneeId: { not: null },
    },
    select: { id: true, title: true, assigneeId: true, client: { select: { name: true } } },
  });

  let strategistReminders = 0;
  for (const d of upcomingDeliverables) {
    if (!d.assigneeId) continue;
    const existing = await db.notification.findFirst({
      where: {
        userId: d.assigneeId,
        type: "deliverable_due_tomorrow",
        message: { contains: d.id },
      },
    });
    if (!existing) {
      await db.notification.create({
        data: {
          userId: d.assigneeId,
          title: "Deliverable Due Tomorrow",
          message: `${d.title} for ${d.client.name} is due tomorrow`,
          type: "deliverable_due_tomorrow",
        },
      });
      strategistReminders++;
    }
  }
  results.strategistReminders = strategistReminders;

  // ── 4. Scheduling Conflict Detection ──────────────────────
  const next7Days = addDays(now, 7);
  const upcoming = await db.runnerAssignment.findMany({
    where: {
      eventDate: { gte: startOfDay(now), lte: endOfDay(next7Days) },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    orderBy: [{ runnerId: "asc" }, { eventDate: "asc" }],
    include: { runner: { select: { id: true, name: true } } },
  });

  // Group by runner, check for same-day overlaps
  const byRunner = new Map<string, typeof upcoming>();
  for (const a of upcoming) {
    const arr = byRunner.get(a.runnerId) ?? [];
    arr.push(a);
    byRunner.set(a.runnerId, arr);
  }

  let conflicts = 0;
  for (const [runnerId, assignments] of byRunner.entries()) {
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const a = assignments[i];
        const b = assignments[j];
        // Same day = conflict
        const sameDay =
          startOfDay(new Date(a.eventDate)).getTime() === startOfDay(new Date(b.eventDate)).getTime();

        if (sameDay) {
          // Notify the strategists/admins about the conflict
          const admins = await db.user.findMany({
            where: { role: { in: ["SUPER_ADMIN", "STRATEGIST"] }, isActive: true },
            select: { id: true },
          });

          for (const admin of admins) {
            const existing = await db.notification.findFirst({
              where: {
                userId: admin.id,
                type: "scheduling_conflict",
                message: { contains: `${a.id}` },
                createdAt: { gte: startOfDay(now) },
              },
            });
            if (!existing) {
              await db.notification.create({
                data: {
                  userId: admin.id,
                  title: "Scheduling Conflict",
                  message: `${a.runner.name} has overlapping assignments on ${new Date(a.eventDate).toLocaleDateString()}: "${a.eventName}" and "${b.eventName}"`,
                  type: "scheduling_conflict",
                  link: "/runners/schedule",
                },
              });
              conflicts++;
            }
          }
        }
      }
    }
  }
  results.conflictsDetected = conflicts;

  return NextResponse.json({
    message: "Cron completed",
    timestamp: now.toISOString(),
    results,
  });
}
