import { db } from "@/lib/db";
import type { DeliverableType } from "@prisma/client";
import { dayKeyInTz, tzMidnight, weekStartKey } from "@/components/runners/miami-time";

/**
 * "No double entry": a confirmed goal (Deliverable) becomes one RunnerAssignment,
 * which is the single row the client agenda AND the general runner agenda both
 * read. The row starts with `runnerId = null` — an activity that needs a runner —
 * and lib/runner-assign.ts fills it in from the runners' availability.
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

/**
 * Make sure a confirmed deliverable with a due date is on the agenda.
 * Idempotent: does nothing when the deliverable already has an assignment.
 */
export async function ensureAgendaItemForDeliverable(
  deliverableId: string
): Promise<{ created: boolean; assignmentId: string | null }> {
  const deliverable = await db.deliverable.findUnique({
    where: { id: deliverableId },
    select: { id: true, clientId: true, title: true, type: true, dueDate: true },
  });
  if (!deliverable || !deliverable.dueDate) return { created: false, assignmentId: null };

  const existing = await db.runnerAssignment.findFirst({
    where: { deliverableId: deliverable.id },
    select: { id: true },
  });
  if (existing) return { created: false, assignmentId: existing.id };

  const created = await db.runnerAssignment.create({
    data: {
      runnerId: null,
      clientId: deliverable.clientId,
      deliverableId: deliverable.id,
      eventDate: deliverable.dueDate,
      eventName: deliverable.title,
      itemType: ITEM_TYPE[deliverable.type] ?? "Other",
      status: "SCHEDULED",
      weekOf: miamiWeekOf(deliverable.dueDate),
    },
    select: { id: true },
  });

  return { created: true, assignmentId: created.id };
}

/**
 * Keep the linked agenda item in step when a deliverable's due date moves.
 * Only touches an assignment that is still unassigned and still linked to this
 * deliverable — a hand-scheduled activity with a real runner is left alone.
 */
export async function syncAgendaItemDate(
  deliverableId: string,
  dueDate: Date | null
): Promise<string | null> {
  if (!dueDate) return null;

  const linked = await db.runnerAssignment.findFirst({
    where: { deliverableId, runnerId: null, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    select: { id: true, eventDate: true },
  });
  if (!linked) return null;
  if (linked.eventDate.getTime() === dueDate.getTime()) return linked.id;

  await db.runnerAssignment.update({
    where: { id: linked.id },
    data: { eventDate: dueDate, weekOf: miamiWeekOf(dueDate) },
  });
  return linked.id;
}
