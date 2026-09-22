import { db } from "@/lib/db";
import { companionWhere } from "@/lib/companions";
import {
  addDaysKey,
  dayKeyInTz,
  dayOfWeekForKey,
  formatDayKey,
  formatInTz,
  minutesOfDayInTz,
  tzMidnight,
  weekStartKey,
} from "@/components/runners/miami-time";

/**
 * Runner auto-scheduling engine.
 *
 * Every activity on the agenda is one RunnerAssignment row. A row with
 * `runnerId = null` is an activity that still "needs a runner". This engine
 * decides who accompanies each of those, from the runners' own availability.
 *
 * All day / time-of-day reasoning happens in Miami time (America/New_York),
 * never in the server's timezone (UTC on Vercel).
 *
 * ── Rules ────────────────────────────────────────────────────────────────
 * A runner is ELIGIBLE for an activity when all of these hold:
 *  a. No RunnerAvailability override for that Miami date says isAvailable=false.
 *     (An override is a veto only — it never grants availability on its own.)
 *  b. Their RunnerWeeklyAvailability windows for that day of week cover the
 *     activity window. The window runs from arrivalTime (else eventTime, else
 *     eventDate's time) through on-air + 2h. When the activity has no time of
 *     day at all, any window on that day counts.
 *     A runner with NO weekly rows at all is never available — the schedule is
 *     only ever generated from real availability data.
 *  c. None of their other non-cancelled assignments that Miami day overlaps.
 *     Each activity is treated as a 3-hour block (no end time is ever stored);
 *     an activity with an unknown time of day blocks the whole day.
 *
 * Among eligible runners: fewest assignments that week, then fewest that day,
 * then alphabetically by name (so the outcome is stable across reruns).
 */

/** Availability must cover the activity through on-air + this many minutes. */
const AVAILABILITY_PAD_MIN = 120;
/** Two activities collide when their 3-hour blocks overlap. */
const CONFLICT_PAD_MIN = 180;
const MINUTES_PER_DAY = 24 * 60;

const ACTIVE_STATUSES = ["SCHEDULED", "CONFIRMED"] as const;

export type AutoAssignReport = {
  assigned: {
    id: string;
    eventName: string;
    dayKey: string;
    time: string | null;
    runnerId: string;
    runnerName: string;
  }[];
  unassigned: { id: string; eventName: string; dayKey: string; reason: string }[];
  /** Miami day keys the run covered. */
  from: string;
  to: string;
};

type AssignmentRow = {
  id: string;
  runnerId: string | null;
  clientId: string | null;
  eventName: string;
  eventDate: Date;
  arrivalTime: Date | null;
  eventTime: Date | null;
};

type Runner = { id: string; name: string };

type Window = { startMin: number; endMin: number };

type Context = {
  runners: Runner[];
  /** `${userId}|${dayOfWeek}` -> merged weekly windows. */
  weekly: Map<string, Window[]>;
  /** `${userId}|${dayKey}` -> isAvailable of the per-date override. */
  overrides: Map<string, boolean>;
  /** `${runnerId}|${dayKey}` -> that runner's assignments that day. */
  byRunnerDay: Map<string, AssignmentRow[]>;
  /** `${runnerId}|${weekStartKey}` -> count of assignments that week. */
  weekLoad: Map<string, number>;
};

type Cause = "override" | "no-weekly" | "window" | "conflict";

// ─── Time helpers ────────────────────────────────────────────────────────

/**
 * True when the instant is the project's "date only" marker (12:00:00.000 UTC,
 * written by parseDateInput). Such a row carries a calendar day but no real
 * time of day.
 */
function isDateOnly(d: Date): boolean {
  return (
    d.getUTCHours() === 12 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

/**
 * The activity's block in minutes from Miami midnight, padded at the end.
 * Returns null when the activity has no time of day.
 */
function timeBlock(a: AssignmentRow, padMinutes: number): Window | null {
  const start = a.arrivalTime ?? a.eventTime ?? (isDateOnly(a.eventDate) ? null : a.eventDate);
  if (!start) return null;
  const main = a.eventTime ?? a.arrivalTime ?? a.eventDate;
  const startMin = minutesOfDayInTz(start);
  const endMin = Math.min(
    MINUTES_PER_DAY,
    Math.max(startMin, minutesOfDayInTz(main)) + padMinutes
  );
  return { startMin, endMin };
}

/** The Miami calendar day an activity belongs to. */
function dayOf(a: AssignmentRow): string {
  return dayKeyInTz(a.eventDate);
}

/** A short "9:30 AM" label, or null when the activity has no time of day. */
function timeLabel(a: AssignmentRow): string | null {
  const start = a.arrivalTime ?? a.eventTime ?? (isDateOnly(a.eventDate) ? null : a.eventDate);
  if (!start) return null;
  return formatInTz(start, { hour: "numeric", minute: "2-digit" });
}

/** Merge overlapping/touching windows so coverage can be checked in one pass. */
function mergeWindows(windows: Window[]): Window[] {
  const sorted = [...windows].sort((a, b) => a.startMin - b.startMin);
  const out: Window[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, w.endMin);
    } else {
      out.push({ ...w });
    }
  }
  return out;
}

function covers(windows: Window[], block: Window): boolean {
  return windows.some((w) => w.startMin <= block.startMin && w.endMin >= block.endMin);
}

function overlaps(a: Window, b: Window): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

/** Accepts a Miami day key ("yyyy-MM-dd") or an instant. */
function toDayKey(value: Date | string): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : dayKeyInTz(value);
}

// ─── Context ─────────────────────────────────────────────────────────────

/**
 * Load everything the engine needs for a Miami day range, padded by a week on
 * each side so weekly load counts and same-day conflicts are complete.
 */
async function loadContext(fromKey: string, toKey: string): Promise<Context> {
  const padStart = tzMidnight(addDaysKey(fromKey, -7));
  const padEnd = tzMidnight(addDaysKey(toKey, 8)); // exclusive

  const [runners, weeklyRows, overrideRows, assignmentRows] = await Promise.all([
    db.user.findMany({
      where: companionWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.runnerWeeklyAvailability.findMany({
      select: { userId: true, dayOfWeek: true, startMinute: true, endMinute: true },
    }),
    db.runnerAvailability.findMany({
      where: { date: { gte: padStart, lt: padEnd } },
      select: { userId: true, date: true, isAvailable: true },
    }),
    db.runnerAssignment.findMany({
      where: {
        runnerId: { not: null },
        eventDate: { gte: padStart, lt: padEnd },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        runnerId: true,
        clientId: true,
        eventName: true,
        eventDate: true,
        arrivalTime: true,
        eventTime: true,
      },
    }),
  ]);

  const rawWeekly = new Map<string, Window[]>();
  for (const r of weeklyRows) {
    const key = `${r.userId}|${r.dayOfWeek}`;
    const arr = rawWeekly.get(key) ?? [];
    arr.push({ startMin: r.startMinute, endMin: r.endMinute });
    rawWeekly.set(key, arr);
  }
  const weekly = new Map<string, Window[]>();
  for (const [key, arr] of rawWeekly) weekly.set(key, mergeWindows(arr));

  const overrides = new Map<string, boolean>();
  for (const o of overrideRows) {
    overrides.set(`${o.userId}|${dayKeyInTz(o.date)}`, o.isAvailable);
  }

  const ctx: Context = {
    runners,
    weekly,
    overrides,
    byRunnerDay: new Map(),
    weekLoad: new Map(),
  };
  for (const a of assignmentRows) trackAssignment(ctx, a);
  return ctx;
}

/** Record an assignment in the in-memory load maps (also used for fresh picks). */
function trackAssignment(ctx: Context, a: AssignmentRow) {
  if (!a.runnerId) return;
  const dayKey = dayOf(a);
  const dayIdx = `${a.runnerId}|${dayKey}`;
  const arr = ctx.byRunnerDay.get(dayIdx) ?? [];
  arr.push(a);
  ctx.byRunnerDay.set(dayIdx, arr);

  const weekIdx = `${a.runnerId}|${weekStartKey(dayKey)}`;
  ctx.weekLoad.set(weekIdx, (ctx.weekLoad.get(weekIdx) ?? 0) + 1);
}

// ─── Eligibility ─────────────────────────────────────────────────────────

function isEligible(
  target: AssignmentRow,
  runnerId: string,
  ctx: Context
): { ok: true } | { ok: false; cause: Cause } {
  const dayKey = dayOf(target);

  // (a) a per-date override that says "not available" vetoes the day
  if (ctx.overrides.get(`${runnerId}|${dayKey}`) === false) {
    return { ok: false, cause: "override" };
  }

  // (b) the recurring weekly pattern must cover the activity window
  const windows = ctx.weekly.get(`${runnerId}|${dayOfWeekForKey(dayKey)}`) ?? [];
  if (windows.length === 0) return { ok: false, cause: "no-weekly" };

  const block = timeBlock(target, AVAILABILITY_PAD_MIN);
  if (block && !covers(windows, block)) return { ok: false, cause: "window" };

  // (c) no collision with anything else the runner already has that day
  const conflictBlock = timeBlock(target, CONFLICT_PAD_MIN);
  const busy = ctx.byRunnerDay.get(`${runnerId}|${dayKey}`) ?? [];
  for (const other of busy) {
    if (other.id === target.id) continue;
    const otherBlock = timeBlock(other, CONFLICT_PAD_MIN);
    // An unknown time of day on either side blocks the whole day.
    if (!otherBlock || !conflictBlock) return { ok: false, cause: "conflict" };
    if (overlaps(conflictBlock, otherBlock)) return { ok: false, cause: "conflict" };
  }

  return { ok: true };
}

function reasonFor(causes: Record<Cause, number>, runnerCount: number): string {
  if (runnerCount === 0) return "No active runners";
  if (causes.conflict > 0) return "Every available runner is already booked at that time";
  if (causes.window > 0) return "No runner's weekly availability covers this time";
  if (causes.override > 0) return "Every runner is marked unavailable on this date";
  return "No runner has weekly availability for this day";
}

/** Rank eligible runners: lightest week, then lightest day, then by name. */
function pickBest(eligible: Runner[], dayKey: string, ctx: Context): Runner {
  const weekKey = weekStartKey(dayKey);
  return [...eligible].sort((a, b) => {
    const weekDiff =
      (ctx.weekLoad.get(`${a.id}|${weekKey}`) ?? 0) - (ctx.weekLoad.get(`${b.id}|${weekKey}`) ?? 0);
    if (weekDiff !== 0) return weekDiff;
    const dayDiff =
      (ctx.byRunnerDay.get(`${a.id}|${dayKey}`)?.length ?? 0) -
      (ctx.byRunnerDay.get(`${b.id}|${dayKey}`)?.length ?? 0);
    if (dayDiff !== 0) return dayDiff;
    return a.name.localeCompare(b.name);
  })[0];
}

// ─── Public API ──────────────────────────────────────────────────────────

/** Monday..Sunday (Miami day keys) of the week after the one containing `now`. */
export function nextWeekRange(now = new Date()): { from: string; to: string } {
  const monday = addDaysKey(weekStartKey(dayKeyInTz(now)), 7);
  return { from: monday, to: addDaysKey(monday, 6) };
}

export async function autoAssignRunners(opts: {
  /** Miami day key or instant. Defaults to next Monday. */
  from?: Date | string;
  /** Miami day key or instant (inclusive). Defaults to next Sunday. */
  to?: Date | string;
  /** Only consider activities with no runner yet (default). */
  onlyUnassigned?: boolean;
  /** Specific assignment ids to (re)decide — overrides the date range. */
  reassignIds?: string[];
  /** Who to attribute the activity log to. Falls back to the chosen runner. */
  actorId?: string;
}): Promise<AutoAssignReport> {
  const fallback = nextWeekRange();
  const fromKey = opts.from ? toDayKey(opts.from) : fallback.from;
  const toKey = opts.to ? toDayKey(opts.to) : fallback.to;
  const onlyUnassigned = opts.onlyUnassigned ?? true;

  const select = {
    id: true,
    runnerId: true,
    clientId: true,
    eventName: true,
    eventDate: true,
    arrivalTime: true,
    eventTime: true,
  } as const;

  const targets: AssignmentRow[] = opts.reassignIds?.length
    ? await db.runnerAssignment.findMany({
        where: { id: { in: opts.reassignIds }, status: { in: [...ACTIVE_STATUSES] } },
        select,
        orderBy: { eventDate: "asc" },
      })
    : await db.runnerAssignment.findMany({
        where: {
          status: { in: [...ACTIVE_STATUSES] },
          eventDate: { gte: tzMidnight(fromKey), lt: tzMidnight(addDaysKey(toKey, 1)) },
          ...(onlyUnassigned ? { runnerId: null } : {}),
        },
        select,
        orderBy: { eventDate: "asc" },
      });

  const report: AutoAssignReport = { assigned: [], unassigned: [], from: fromKey, to: toKey };
  if (targets.length === 0) return report;

  // With explicit ids the range may sit outside from/to — widen the context.
  const dayKeys = targets.map(dayOf).sort();
  const ctxFrom = dayKeys[0] < fromKey ? dayKeys[0] : fromKey;
  const ctxTo = dayKeys[dayKeys.length - 1] > toKey ? dayKeys[dayKeys.length - 1] : toKey;
  const ctx = await loadContext(ctxFrom, ctxTo);

  for (const target of targets) {
    const dayKey = dayOf(target);
    const causes: Record<Cause, number> = { override: 0, "no-weekly": 0, window: 0, conflict: 0 };
    const eligible: Runner[] = [];

    for (const runner of ctx.runners) {
      const verdict = isEligible(target, runner.id, ctx);
      if (verdict.ok) eligible.push(runner);
      else causes[verdict.cause]++;
    }

    if (eligible.length === 0) {
      report.unassigned.push({
        id: target.id,
        eventName: target.eventName,
        dayKey,
        reason: reasonFor(causes, ctx.runners.length),
      });
      continue;
    }

    const chosen = pickBest(eligible, dayKey, ctx);
    const assignedAt = new Date();

    await db.runnerAssignment.update({
      where: { id: target.id },
      data: { runnerId: chosen.id, autoAssigned: true, assignedAt },
    });

    // Keep the in-memory load current so the next activity sees this pick.
    trackAssignment(ctx, { ...target, runnerId: chosen.id });

    const when = timeLabel(target);
    await db.notification.create({
      data: {
        userId: chosen.id,
        title: "New assignment",
        message: `${target.eventName} — ${formatDayKey(dayKey, "EEE, MMM d")}${when ? ` at ${when}` : ""}`,
        type: "runner_auto_assigned",
        link: `/runner-portal?assignment=${target.id}`,
      },
    });

    await db.activityLog.create({
      data: {
        clientId: target.clientId,
        userId: opts.actorId ?? chosen.id,
        action: "runner_auto_assigned",
        description: `Auto-assigned ${chosen.name} to "${target.eventName}" on ${formatDayKey(dayKey, "MMM d, yyyy")}`,
        metadata: { assignmentId: target.id, runnerId: chosen.id, dayKey },
      },
    });

    report.assigned.push({
      id: target.id,
      eventName: target.eventName,
      dayKey,
      time: when,
      runnerId: chosen.id,
      runnerName: chosen.name,
    });
  }

  return report;
}

/** Tell SUPER_ADMIN / STRATEGIST that an activity has nobody on it. */
export async function notifyNeedsRunner(assignment: {
  id: string;
  eventName: string;
  eventDate: Date;
  clientId: string | null;
}) {
  const team = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "STRATEGIST"] }, isActive: true },
    select: { id: true },
  });
  if (!team.length) return;
  const dayKey = dayKeyInTz(assignment.eventDate);
  await db.notification.createMany({
    data: team.map((t) => ({
      userId: t.id,
      title: "Activity needs a runner",
      message: `"${assignment.eventName}" on ${formatDayKey(dayKey, "EEE, MMM d")} has no available runner`,
      type: "assignment_needs_runner",
      link: assignment.clientId
        ? `/clients/${assignment.clientId}/agenda?assignment=${assignment.id}`
        : `/runners/schedule?assignment=${assignment.id}`,
    })),
  });
}

/**
 * Called after an assignment's eventDate / eventTime / arrivalTime changed.
 * An auto-assigned runner who is no longer eligible is dropped and the engine
 * re-runs for that one activity; if nobody can take it, the team is notified.
 */
export async function reassignAfterTimeChange(
  assignmentId: string,
  actorId?: string
): Promise<{ changed: boolean; report: AutoAssignReport | null }> {
  const a = await db.runnerAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      runnerId: true,
      clientId: true,
      eventName: true,
      eventDate: true,
      arrivalTime: true,
      eventTime: true,
      autoAssigned: true,
      status: true,
    },
  });
  if (!a || !a.autoAssigned || !a.runnerId) return { changed: false, report: null };
  if (a.status === "CANCELLED" || a.status === "COMPLETED") return { changed: false, report: null };

  const dayKey = dayKeyInTz(a.eventDate);
  const ctx = await loadContext(dayKey, dayKey);
  if (isEligible(a, a.runnerId, ctx).ok) return { changed: false, report: null };

  await db.runnerAssignment.update({
    where: { id: a.id },
    data: { runnerId: null, autoAssigned: false, assignedAt: null },
  });

  const report = await autoAssignRunners({ reassignIds: [a.id], actorId });
  if (report.unassigned.length > 0) {
    await notifyNeedsRunner({
      id: a.id,
      eventName: a.eventName,
      eventDate: a.eventDate,
      clientId: a.clientId,
    });
  }
  return { changed: true, report };
}
