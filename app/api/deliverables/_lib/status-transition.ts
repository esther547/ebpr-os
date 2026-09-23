import { db } from "@/lib/db";
import { slackDeliverableCompleted } from "@/lib/slack";
import type { DeliverableStatus } from "@prisma/client";
import { ensureAgendaItemForDeliverable } from "./agenda-sync";

/**
 * Side effects of a deliverable status change (activity log, notifications, Slack).
 * Shared by PUT /api/deliverables/[id] and POST /api/deliverables/[id]/status so that
 * every path that changes a status produces the same trail.
 */
export async function recordStatusTransition(opts: {
  deliverable: { id: string; clientId: string; title: string };
  from: DeliverableStatus;
  to: DeliverableStatus;
  userId: string;
  outcome?: string | null;
  /** Strategist who closed the goal (only meaningful when `to` is COMPLETED). */
  closedBy?: { id: string; name: string } | null;
}) {
  const { deliverable, from, to, userId, outcome } = opts;
  if (from === to) return;
  const closedBy = to === "COMPLETED" ? opts.closedBy ?? null : null;

  await db.activityLog.create({
    data: {
      clientId: deliverable.clientId,
      deliverableId: deliverable.id,
      userId,
      action: "status_changed",
      description:
        `"${deliverable.title}" moved to ${to.replace(/_/g, " ").toLowerCase()}` +
        (closedBy ? ` — cerrada por ${closedBy.name}` : ""),
      metadata: { from, to, ...(closedBy && { closedById: closedBy.id }) },
    },
  });

  const link = `/clients/${deliverable.clientId}/deliverables/${deliverable.id}`;

  // A goal that is happening belongs on the agenda — once, as a single row that
  // the client agenda and the runner schedule both read. It starts with no
  // runner; the auto-scheduler decides who accompanies it.
  if (to === "CONFIRMED" || to === "IN_PROGRESS") {
    try {
      await ensureAgendaItemForDeliverable(deliverable.id, userId);
    } catch (err) {
      console.error("Agenda sync failed:", err);
    }
  }

  if (to === "COMPLETED") {
    const clientData = await db.client.findUnique({
      where: { id: deliverable.clientId },
      select: { name: true },
    });
    if (clientData) {
      try {
        await slackDeliverableCompleted(clientData.name, deliverable.title, outcome ?? undefined);
      } catch (err) {
        console.error("Slack notification failed:", err);
      }
    }
    const teamUsers = await db.user.findMany({
      where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } },
      select: { id: true },
    });
    if (teamUsers.length) {
      await db.notification.createMany({
        data: teamUsers.map((u) => ({
          userId: u.id,
          title: "Deliverable Completed",
          message: `"${deliverable.title}" has been marked as completed${closedBy ? ` — cerrada por ${closedBy.name}` : ""}`,
          type: "deliverable_completed",
          link,
        })),
      });
    }
  }

  // IDEA/OUTREACH -> CONFIRMED: the team must assign a runner
  if (to === "CONFIRMED" && (from === "IDEA" || from === "OUTREACH")) {
    const teamUsers = await db.user.findMany({
      where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } },
      select: { id: true },
    });
    if (teamUsers.length) {
      await db.notification.createMany({
        data: teamUsers.map((u) => ({
          userId: u.id,
          title: "Deliverable Confirmed",
          message: `"${deliverable.title}" has been confirmed — assign a runner`,
          type: "deliverable_confirmed",
          link,
        })),
      });
    }
  }
}

/** "YYYY-MM-DD" from a date input -> noon UTC so the calendar day survives any timezone. */
export function parseDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Date(value);
}
