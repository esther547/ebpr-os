import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageDeliverables } from "@/lib/permissions";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;

    const deliverable = await db.deliverable.findUniqueOrThrow({
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

    return NextResponse.json({ data: deliverable });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!canManageDeliverables(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateDeliverableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.title !== undefined) data.title = d.title;
    if (d.type !== undefined) data.type = d.type;
    if (d.status !== undefined) {
      data.status = d.status;
      if (d.status === "COMPLETED") data.completedAt = new Date();
    }
    if (d.assigneeId !== undefined) data.assigneeId = d.assigneeId;
    if (d.dueDate !== undefined) data.dueDate = d.dueDate ? new Date(d.dueDate) : null;
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

    await db.activityLog.create({
      data: {
        clientId: deliverable.clientId,
        deliverableId: deliverable.id,
        userId: user.id,
        action: "deliverable_updated",
        description: `Updated deliverable "${deliverable.title}"`,
      },
    });

    return NextResponse.json({ data: deliverable });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
