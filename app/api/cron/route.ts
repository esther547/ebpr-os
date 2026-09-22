import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, NO_STORE } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import {
  addDaysKey,
  dayBounds,
  dayKeyInTz,
  formatDayKey,
  formatInTz,
  tzMidnight,
} from "@/components/runners/miami-time";
import { syncAllAgendaDocs, type AgendaDocSyncReport } from "@/lib/google-docs-writer";

/**
 * Cron endpoint — called daily (8am Miami) to generate notifications:
 * 1. Runner reminders (24h before + same day)
 * 2. Strategist reminders (deliverable due tomorrow)
 * 3. Scheduling conflict detection (same runner, same day)
 *
 * Idempotent: every notification carries a stable link that embeds the
 * record id(s) it is about, and we dedupe on (userId, type, link), so running
 * the job twice never creates duplicates.
 *
 * All "today / tomorrow" windows are computed in Miami time, not the server's
 * timezone (UTC on Vercel), so a 10pm event is not treated as the next day.
 */
export const dynamic = "force-dynamic";

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

async function notifyOnce(data: {
  userId: string;
  title: string;
  message: string;
  type: string;
  link: string;
}): Promise<boolean> {
  const existing = await db.notification.findFirst({
    where: { userId: data.userId, type: data.type, link: data.link },
    select: { id: true },
  });
  if (existing) return false;
  await db.notification.create({ data });
  return true;
}

export async function GET(req: NextRequest) {
  const denied = await authorizeCron(req);
  if (denied) return denied;

  const now = new Date();
  const todayKey = dayKeyInTz(now);
  const tomorrowKey = addDaysKey(todayKey, 1);
  const today = dayBounds(todayKey);
  const tomorrow = dayBounds(tomorrowKey);
  const results: Record<string, number> = {};

  const assignmentSelect = {
    id: true,
    runnerId: true,
    eventName: true,
    eventDate: true,
    eventTime: true,
    arrivalTime: true,
    venueName: true,
    location: true,
    runner: { select: { id: true, name: true } },
  } as const;

  const describe = (a: {
    eventDate: Date;
    eventTime: Date | null;
    arrivalTime: Date | null;
    venueName: string | null;
    location: string | null;
  }) => {
    const parts: string[] = [];
    if (a.arrivalTime) parts.push(`arrive ${formatInTz(a.arrivalTime, TIME)}`);
    const start = a.eventTime ?? a.eventDate;
    parts.push(`${a.arrivalTime ? "on air " : "at "}${formatInTz(start, TIME)}`);
    const place = a.venueName || a.location;
    if (place) parts.push(place);
    return parts.join(" · ");
  };

  // ── 1. Runner Reminders (24h before) ──────────────────────
  const tomorrowAssignments = await db.runnerAssignment.findMany({
    where: {
      eventDate: { gte: tomorrow.gte, lt: tomorrow.lt },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    select: assignmentSelect,
  });

  let runnerReminders = 0;
  for (const a of tomorrowAssignments) {
    // An activity with no runner yet has nobody to remind.
    if (!a.runnerId) continue;
    const created = await notifyOnce({
      userId: a.runnerId,
      title: "Assignment Tomorrow",
      message: `${a.eventName} — tomorrow, ${describe(a)}`,
      type: "runner_reminder_24h",
      link: `/runner-portal?assignment=${a.id}`,
    });
    if (created) runnerReminders++;
  }
  results.runnerReminders24h = runnerReminders;

  // ── 2. Same-day Runner Reminders ──────────────────────────
  const todayAssignments = await db.runnerAssignment.findMany({
    where: {
      eventDate: { gte: today.gte, lt: today.lt },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    select: assignmentSelect,
  });

  let sameDayReminders = 0;
  for (const a of todayAssignments) {
    if (!a.runnerId) continue;
    const created = await notifyOnce({
      userId: a.runnerId,
      title: "Assignment Today",
      message: `${a.eventName} — today, ${describe(a)}`,
      type: "runner_reminder_today",
      link: `/runner-portal?assignment=${a.id}`,
    });
    if (created) sameDayReminders++;
  }
  results.runnerRemindersToday = sameDayReminders;

  // ── 3. Notify strategist of deliverables due tomorrow ─────
  const upcomingDeliverables = await db.deliverable.findMany({
    where: {
      dueDate: { gte: tomorrow.gte, lt: tomorrow.lt },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      assigneeId: { not: null },
    },
    select: {
      id: true,
      title: true,
      assigneeId: true,
      clientId: true,
      client: { select: { name: true } },
    },
  });

  let strategistReminders = 0;
  for (const d of upcomingDeliverables) {
    if (!d.assigneeId) continue;
    const created = await notifyOnce({
      userId: d.assigneeId,
      title: "Deliverable Due Tomorrow",
      message: `${d.title} for ${d.client.name} is due tomorrow`,
      type: "deliverable_due_tomorrow",
      link: `/clients/${d.clientId}/deliverables?deliverable=${d.id}`,
    });
    if (created) strategistReminders++;
  }
  results.strategistReminders = strategistReminders;

  // ── 4. Scheduling Conflict Detection (next 7 days) ───────
  const horizon = tzMidnight(addDaysKey(todayKey, 8)); // exclusive
  const upcoming = await db.runnerAssignment.findMany({
    where: {
      eventDate: { gte: today.gte, lt: horizon },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    orderBy: [{ runnerId: "asc" }, { eventDate: "asc" }],
    select: assignmentSelect,
  });

  // Group by runner + Miami calendar day
  const byRunnerDay = new Map<string, typeof upcoming>();
  for (const a of upcoming) {
    // Unassigned activities cannot clash with anything — they have no runner.
    if (!a.runnerId || !a.runner) continue;
    const key = `${a.runnerId}|${dayKeyInTz(a.eventDate)}`;
    const arr = byRunnerDay.get(key) ?? [];
    arr.push(a);
    byRunnerDay.set(key, arr);
  }

  const admins = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "STRATEGIST"] }, isActive: true },
    select: { id: true },
  });

  let conflicts = 0;
  for (const [key, assignments] of byRunnerDay.entries()) {
    if (assignments.length < 2) continue;
    const dayKey = key.split("|")[1];
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const a = assignments[i];
        const b = assignments[j];
        // Stable pair id regardless of ordering
        const pair = [a.id, b.id].sort().join(",");
        const message = `${a.runner?.name ?? "A runner"} has overlapping assignments on ${formatDayKey(dayKey, "EEE, MMM d")}: "${a.eventName}" (${formatInTz(a.eventTime ?? a.eventDate, TIME)}) and "${b.eventName}" (${formatInTz(b.eventTime ?? b.eventDate, TIME)})`;
        for (const admin of admins) {
          const created = await notifyOnce({
            userId: admin.id,
            title: "Scheduling Conflict",
            message,
            type: "scheduling_conflict",
            link: `/runners/schedule?conflict=${pair}`,
          });
          if (created) conflicts++;
        }
      }
    }
  }
  results.conflictsDetected = conflicts;

  // ── 5. Mirror every active client's agenda into its Google Doc ────
  // The portal is the source of truth: each "Agenda 2026" doc is regenerated
  // from the RunnerAssignment rows every night. This rides along with the daily
  // cron because Vercel Hobby allows only two cron entries and both are taken.
  // Docs that have not been shared with the service account as Editor come back
  // as a clean per-client error — they never fail the rest of the job.
  let agendaDocs: AgendaDocSyncReport | { error: string };
  try {
    agendaDocs = await syncAllAgendaDocs();
  } catch (err) {
    console.error("Cron: agenda doc sync failed:", err);
    agendaDocs = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json(
    { message: "Cron completed", timestamp: now.toISOString(), today: todayKey, results, agendaDocs },
    { headers: NO_STORE }
  );
}
