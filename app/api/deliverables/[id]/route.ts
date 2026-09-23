import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cycleForDate } from "@/lib/cycles";
import { requireUser } from "@/lib/auth";
import { canManageDeliverables } from "@/lib/permissions";
import { parseDateInput, recordStatusTransition } from "../_lib/status-transition";
import { resolveCloser, type Closer } from "../_lib/closer";
import { syncAgendaItemDetails, activityInstant } from "../_lib/agenda-sync";
import { checkClientDate, dayKeyOf } from "@/lib/client-availability";

const updateDeliverableSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.enum([
    "PRESS_PLACEMENT", "INTERVIEW", "INFLUENCER_COLLAB", "EVENT_APPEARANCE",
    "BRAND_OPPORTUNITY", "INTRODUCTION", "SOCIAL_MEDIA", "PRESS_RELEASE", "OTHER",
  ]).optional(),
  status: z.enum(["IDEA", "OUTREACH", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  outcome: z.string().nullable().optional(),
  isClientVisible: z.boolean().optional(),
  eventTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  venueName: z.string().max(200).nullable().optional(),
  venueAddress: z.string().max(300).nullable().optional(),
  needsRunner: z.boolean().optional(),
  /** Strategist who closed the goal; used when the goal is (or becomes) COMPLETED. */
  closedById: z.string().min(1).nullable().optional(),
});

function zodMessage(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
    .join("; ");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const deliverable = await db.deliverable.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, avatar: true } },
      closedBy: { select: { id: true, name: true } },
      strategyItem: { select: { id: true, title: true, category: true } },
      campaign: { select: { id: true, name: true } },
      tasks: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      comments: {
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: "desc" },
      },
      files: { orderBy: { createdAt: "desc" } },
      approvals: { orderBy: { createdAt: "desc" } },
      activityLogs: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!deliverable) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: deliverable });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageDeliverables(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateDeliverableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error), details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.deliverable.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        title: true,
        status: true,
        dueDate: true,
        eventTime: true,
        assigneeId: true,
        completedAt: true,
        closedById: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Prisma.DeliverableUncheckedUpdateInput = {};
    const d = parsed.data;
    if (d.title !== undefined) data.title = d.title;
    if (d.type !== undefined) data.type = d.type;
    const statusChanged = d.status !== undefined && d.status !== existing.status;
    if (statusChanged) {
      data.status = d.status;
      data.completedAt = d.status === "COMPLETED" ? new Date() : null;
      if (d.status !== "COMPLETED") data.closedById = null; // leaving COMPLETED clears the closer
    }

    // Who closed the goal: recorded when it becomes COMPLETED, or (re)assigned explicitly
    // on a goal that is already COMPLETED.
    const effectiveStatus = d.status ?? existing.status;
    let closer: Closer | null = null;
    if (
      effectiveStatus === "COMPLETED" &&
      (statusChanged || (d.closedById !== undefined && d.closedById !== null))
    ) {
      const resolved = await resolveCloser({
        requestedId: d.closedById,
        currentUser: user,
        assigneeId: d.assigneeId !== undefined ? d.assigneeId || null : existing.assigneeId,
      });
      if (resolved.error !== undefined) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      closer = resolved.closer;
      data.closedById = closer?.id ?? null;
      if (!statusChanged && !existing.completedAt) data.completedAt = new Date();
    }
    if (d.assigneeId !== undefined) data.assigneeId = d.assigneeId || null;
    if (d.dueDate !== undefined) {
      data.dueDate = d.dueDate ? parseDateInput(d.dueDate) : null;
      // Re-tag the goal cycle when the due date moves (per-client fecha de corte).
      if (data.dueDate instanceof Date) {
        const owner = await db.client.findUnique({ where: { id: existing.clientId }, select: { cycleDay: true } });
        const cycle = cycleForDate(owner?.cycleDay, data.dueDate);
        data.month = cycle.month;
        data.year = cycle.year;
      }
    }

    // Client availability. Moving the due date into an OFF window is refused; a date
    // inside a TRAVEL window (or an unchanged date that is now inside OFF) saves with a warning.
    const effectiveDueDate = d.dueDate !== undefined ? (data.dueDate as Date | null) : existing.dueDate;
    const availability = await checkClientDate(existing.clientId, effectiveDueDate);
    const dueDayMoved =
      d.dueDate !== undefined &&
      (effectiveDueDate ? dayKeyOf(effectiveDueDate) : null) !==
        (existing.dueDate ? dayKeyOf(existing.dueDate) : null);
    if (availability.blocked && dueDayMoved) {
      return NextResponse.json({ error: availability.warning }, { status: 409 });
    }

    if (d.venueName !== undefined) data.venueName = d.venueName?.trim() || null;
    if (d.venueAddress !== undefined) data.venueAddress = d.venueAddress?.trim() || null;
    if (d.needsRunner !== undefined) data.needsRunner = d.needsRunner;
    // Activity time is tied to the (possibly new) due date's calendar day.
    if (d.eventTime !== undefined || d.dueDate !== undefined) {
      const effectiveDue = d.dueDate !== undefined ? (data.dueDate as Date | null) : existing.dueDate;
      const dayKey = effectiveDue ? new Date(effectiveDue).toISOString().slice(0, 10) : null;
      const hhmm =
        d.eventTime !== undefined
          ? d.eventTime
          : existing.eventTime
            ? new Date(existing.eventTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" })
            : null;
      data.eventTime = dayKey ? activityInstant(dayKey, hhmm) : null;
    }
    if (d.notes !== undefined) data.notes = d.notes;
    if (d.outcome !== undefined) data.outcome = d.outcome;
    if (d.isClientVisible !== undefined) data.isClientVisible = d.isClientVisible;

    const deliverable = await db.deliverable.update({
      where: { id },
      data,
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
        closedBy: { select: { id: true, name: true } },
      },
    });

    // Keep the linked agenda item (client agenda + runner schedule) in step with
    // the goal's date, time, place and title; re-check the runner if the time moved.
    if (d.dueDate !== undefined || d.eventTime !== undefined || d.venueName !== undefined || d.venueAddress !== undefined || d.title !== undefined) {
      try {
        await syncAgendaItemDetails(deliverable.id, user.id);
      } catch (err) {
        console.error("Agenda sync failed:", err);
      }
    }

    if (d.status !== undefined && d.status !== existing.status) {
      await recordStatusTransition({
        deliverable: existing,
        from: existing.status,
        to: d.status,
        userId: user.id,
        outcome: d.outcome,
        closedBy: closer,
      });
    } else {
      await db.activityLog.create({
        data: {
          clientId: deliverable.clientId,
          deliverableId: deliverable.id,
          userId: user.id,
          action: "deliverable_updated",
          description:
            `Updated deliverable "${deliverable.title}"` +
            (closer && closer.id !== existing.closedById ? ` — cerrada por ${closer.name}` : ""),
          ...(closer && closer.id !== existing.closedById && {
            metadata: { closedById: closer.id, previousClosedById: existing.closedById },
          }),
        },
      });
    }

    return NextResponse.json({ data: deliverable, warning: availability.warning });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("PUT /api/deliverables/[id] failed:", err);
    return NextResponse.json({ error: "Could not update deliverable" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageDeliverables(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.deliverable.findUnique({
    where: { id },
    select: { id: true, clientId: true, title: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Detach/clean dependents that have no cascade so nothing is orphaned or blocks the delete.
  await db.$transaction([
    db.comment.deleteMany({ where: { deliverableId: id } }),
    db.activityLog.updateMany({ where: { deliverableId: id }, data: { deliverableId: null } }),
    db.task.updateMany({ where: { deliverableId: id }, data: { deliverableId: null } }),
    db.file.updateMany({ where: { deliverableId: id }, data: { deliverableId: null } }),
    db.approval.updateMany({ where: { deliverableId: id }, data: { deliverableId: null } }),
    db.runnerAssignment.updateMany({ where: { deliverableId: id }, data: { deliverableId: null } }),
    db.deliverable.delete({ where: { id } }),
    db.activityLog.create({
      data: {
        clientId: existing.clientId,
        userId: user.id,
        action: "deliverable_deleted",
        description: `Deleted deliverable "${existing.title}"`,
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
