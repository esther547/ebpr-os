import { db } from "@/lib/db";
import type { DeliverableType } from "@prisma/client";
import { dayKeyInTz, tzMidnight, weekStartKey } from "@/components/runners/miami-time";
import { autoAssignRunners, reassignAfterTimeChange } from "@/lib/runner-assign";
import { checkClientDate } from "@/lib/client-availability";

/**
 * "No double entry": a confirmed goal (Deliverable) becomes one RunnerAssignment,
 * which is the single row the client agenda AND the general runner agenda both read.
 * The activity is created with the goal's time and place, and a runner is assigned
 * immediately (least-loaded available runner); the team can override on the agenda.
 */

const ITEM_TYPE: Record<DeliverableType, string> = {
  EVENT_APPEARANCE: "Event",
  INTERVIEW: "Interview",
  PRESS_PLACEMENT: "Press",
  INFLUENCER_COLLAB: "Influencer",
  BRAND_OPPORTUNITY: "Brand Opportunity",
  INTRODUCTION: "Introduction",
  SOCIAL_MEDIA: "Social Media",
  PRESS_RELEASE: "Press Release",
  OTHER: "Other",
};

/** Monday 00:00 (Miami) of the week containing the given instant. */
export function miamiWeekOf(date: Date): Date {
  return tzMidnight(weekStartKey(dayKeyInTz(date)));
}

/** Combine a "yyyy-MM-dd" (Miami calendar day) and "HH:mm" into an instant. Null when no time. */
export function activityInstant(dayKey: string, hhmm: string | null | undefined): Date | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(tzMidnight(dayKey).getTime() + (h * 60 + m) * 60_000);
}

/**
 * Make sure a confirmed deliverable with a due date is on the agenda, then try to
 * assign a runner right away. Idempotent: does nothing when an assignment exists.
 */
export async function ensureAgendaItemForDeliverable(
  deliverableId: string,
  actorId?: string
): Promise<{ created: boolean; assignmentId: string | null; runnerName?: string | null; reason?: string }> {
  const d = await db.deliverable.findUnique({
    where: { id: deliverableId },
    select: {
      id: true, clientId: true, title: true, type: true, dueDate: true,
      eventTime: true, venueName: true, venueAddress: true, needsRunner: true, notes: true,
    },
  });
  if (!d || !d.dueDate) return { created: false, assignmentId: null };

  const existing = await db.runnerAssignment.findFirst({
    where: { deliverableId: d.id, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  if (existing) return { created: false, assignmentId: existing.id };

  const eventDate = d.eventTime ?? d.dueDate;

  // Never book the agenda on a day the client is OFF.
  const availability = await checkClientDate(d.clientId, eventDate);
  if (availability.blocked) {
    const reason = availability.warning ?? "El cliente no está disponible en esa fecha";
    console.warn(`[agenda-sync] Not adding "${d.title}" (${d.id}) to the agenda: ${reason}`);
    return { created: false, assignmentId: null, reason };
  }

  const created = await db.runnerAssignment.create({
    data: {
      runnerId: null,
      clientId: d.clientId,
      deliverableId: d.id,
      eventDate,
      eventTime: d.eventTime,
      eventName: d.title,
      venueName: d.venueName,
      venueAddress: d.venueAddress,
      location: d.venueName,
      itemType: ITEM_TYPE[d.type] ?? "Other",
      status: "SCHEDULED",
      weekOf: miamiWeekOf(eventDate),
      notes: d.needsRunner ? null : "No requiere runner",
    },
    select: { id: true },
  });

  let runnerName: string | null = null;
  if (d.needsRunner) {
    try {
      const report = await autoAssignRunners({ reassignIds: [created.id], actorId });
      runnerName = report.assigned[0]?.runnerName ?? null;
    } catch (err) {
      console.error("Immediate runner assignment failed:", err);
    }
  }
  return { created: true, assignmentId: created.id, runnerName };
}

/**
 * Keep the linked agenda item in step when the goal's date, time, place or title change.
 * Updates the row whether or not a runner is already assigned; if the time moved and the
 * runner was auto-assigned, the engine re-checks availability and swaps if needed.
 */
export async function syncAgendaItemDetails(
  deliverableId: string,
  actorId?: string
): Promise<string | null> {
  const d = await db.deliverable.findUnique({
    where: { id: deliverableId },
    select: { id: true, title: true, dueDate: true, eventTime: true, venueName: true, venueAddress: true },
  });
  if (!d || !d.dueDate) return null;

  const linked = await db.runnerAssignment.findFirst({
    where: { deliverableId, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    select: { id: true, eventDate: true, eventTime: true },
  });
  if (!linked) return null;

  const eventDate = d.eventTime ?? d.dueDate;
  const timeChanged =
    linked.eventDate.getTime() !== eventDate.getTime() ||
    (linked.eventTime?.getTime() ?? null) !== (d.eventTime?.getTime() ?? null);

  await db.runnerAssignment.update({
    where: { id: linked.id },
    data: {
      eventDate,
      eventTime: d.eventTime,
      eventName: d.title,
      venueName: d.venueName,
      venueAddress: d.venueAddress,
      location: d.venueName,
      weekOf: miamiWeekOf(eventDate),
    },
  });

  if (timeChanged) {
    try {
      await reassignAfterTimeChange(linked.id, actorId);
    } catch (err) {
      console.error("Re-assignment after goal time change failed:", err);
    }
  }
  return linked.id;
}

/** @deprecated use syncAgendaItemDetails */
export async function syncAgendaItemDate(deliverableId: string): Promise<string | null> {
  return syncAgendaItemDetails(deliverableId);
}
