import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageDeliverables } from "@/lib/permissions";
import { parseDateInput, recordStatusTransition } from "../_lib/status-transition";

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
      select: { id: true, clientId: true, title: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Prisma.DeliverableUncheckedUpdateInput = {};
    const d = parsed.data;
    if (d.title !== undefined) data.title = d.title;
    if (d.type !== undefined) data.type = d.type;
    if (d.status !== undefined && d.status !== existing.status) {
      data.status = d.status;
      data.completedAt = d.status === "COMPLETED" ? new Date() : null;
    }
    if (d.assigneeId !== undefined) data.assigneeId = d.assigneeId || null;
    if (d.dueDate !== undefined) data.dueDate = d.dueDate ? parseDateInput(d.dueDate) : null;
    if (d.notes !== undefined) data.notes = d.notes;
    if (d.outcome !== undefined) data.outcome = d.outcome;
    if (d.isClientVisible !== undefined) data.isClientVisible = d.isClientVisible;

    const deliverable = await db.deliverable.update({
      where: { id },
      data,
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
      },
    });

    if (d.status !== undefined && d.status !== existing.status) {
      await recordStatusTransition({
        deliverable: existing,
        from: existing.status,
        to: d.status,
        userId: user.id,
        outcome: d.outcome,
      });
    } else {
      await db.activityLog.create({
        data: {
          clientId: deliverable.clientId,
          deliverableId: deliverable.id,
          userId: user.id,
          action: "deliverable_updated",
          description: `Updated deliverable "${deliverable.title}"`,
        },
      });
    }

    return NextResponse.json({ data: deliverable });
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
