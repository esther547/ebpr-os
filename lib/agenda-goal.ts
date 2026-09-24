import { db } from "@/lib/db";
import type { DeliverableType, UserRole } from "@prisma/client";
import { cycleForDate } from "@/lib/cycles";
import { CLOSER_ROLES } from "@/app/api/deliverables/_lib/closer";

/**
 * A pauta added to a client's agenda IS a goal for the team: when a strategist
 * schedules an appearance, the goal was already closed. This creates the linked
 * Deliverable so it shows on the client's Metas and on the per-strategist report.
 *   past date  -> COMPLETED, completedAt = event date, closedBy = creator
 *   future     -> CONFIRMED (auto-completes when the runner marks the pauta done)
 * Idempotent: does nothing if the assignment already has a deliverable.
 */
export function goalTypeFor(itemType: string | null | undefined, eventName: string): DeliverableType {
  const t = `${itemType ?? ""} ${eventName}`.toLowerCase();
  if (/podcast|entrevista|interview|tv|television|radio|univision|telemundo|cnn|noticias|news/.test(t)) return "INTERVIEW";
  if (/instagram|tiktok|reel|social|colab|collab|creador|influencer/.test(t)) return "INFLUENCER_COLLAB";
  if (/press|prensa|revista|magazine|blog|article|nota/.test(t)) return "PRESS_PLACEMENT";
  if (/brand|marca|deal|sponsor/.test(t)) return "BRAND_OPPORTUNITY";
  if (/event|evento|red carpet|alfombra|gala|premiere|launch|concierto|show|fashion/.test(t)) return "EVENT_APPEARANCE";
  return "OTHER";
}

export async function ensureGoalForAgendaItem(
  assignmentId: string,
  creator: { id: string; role: UserRole }
): Promise<string | null> {
  const a = await db.runnerAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true, clientId: true, deliverableId: true, eventName: true, eventDate: true, eventTime: true,
      venueName: true, venueAddress: true, itemType: true, notes: true, status: true,
    },
  });
  if (!a || a.deliverableId || !a.clientId || a.status === "CANCELLED") return a?.deliverableId ?? null;
  const client = await db.client.findUnique({ where: { id: a.clientId }, select: { cycleDay: true } });

  const isPast = a.eventDate.getTime() < Date.now();
  const isStrategist = CLOSER_ROLES.includes(creator.role);
  const cycle = cycleForDate(client?.cycleDay, a.eventDate);

  const goal = await db.deliverable.create({
    data: {
      clientId: a.clientId,
      title: a.eventName,
      type: goalTypeFor(a.itemType, a.eventName),
      status: isPast ? "COMPLETED" : "CONFIRMED",
      completedAt: isPast ? a.eventDate : null,
      closedById: isPast && isStrategist ? creator.id : null,
      assigneeId: isStrategist ? creator.id : null,
      dueDate: a.eventDate,
      eventTime: a.eventTime,
      venueName: a.venueName,
      venueAddress: a.venueAddress,
      needsRunner: true,
      month: cycle.month,
      year: cycle.year,
      notes: a.notes,
    },
    select: { id: true },
  });
  await db.runnerAssignment.update({ where: { id: a.id }, data: { deliverableId: goal.id } });
  return goal.id;
}
