import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageTasks } from "@/lib/permissions";

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  clientId: z.string().optional(),
  deliverableId: z.string().optional(),
  campaignId: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canManageTasks(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const deliverableId = searchParams.get("deliverableId");
    const assigneeId = searchParams.get("assigneeId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (deliverableId) where.deliverableId = deliverableId;
    if (assigneeId) where.assigneeId = assigneeId;
    if (status) where.status = status;

    const tasks = await db.task.findMany({
      where,
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
        createdBy: { select: { id: true, name: true } },
        deliverable: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ data: tasks });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canManageTasks(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { title, description, clientId, deliverableId, campaignId, assigneeId, priority, dueDate } = parsed.data;

    const task = await db.task.create({
      data: {
        title,
        description,
        clientId,
        deliverableId,
        campaignId,
        assigneeId,
        createdById: user.id,
        priority,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
      },
    });

    if (clientId) {
      await db.activityLog.create({
        data: {
          clientId,
          userId: user.id,
          action: "task_created",
          description: `Created task "${title}"`,
        },
      });
    }

    return NextResponse.json({ data: task }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
