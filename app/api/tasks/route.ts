import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageTasks } from "@/lib/permissions";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().optional(),
  clientId: z.string().optional(),
  deliverableId: z.string().optional(),
  campaignId: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().optional(),
});

/** "YYYY-MM-DD" -> noon UTC so the calendar day is stable in every timezone. */
function parseDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Date(value);
}

function zodMessage(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
    .join("; ");
}

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageTasks(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error), details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, clientId, deliverableId, campaignId, assigneeId, priority, dueDate } = parsed.data;

    if (assigneeId) {
      const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { id: true } });
      if (!assignee) {
        return NextResponse.json({ error: "Assignee not found" }, { status: 400 });
      }
    }

    const task = await db.task.create({
      data: {
        title,
        description,
        clientId: clientId || undefined,
        deliverableId: deliverableId || undefined,
        campaignId: campaignId || undefined,
        assigneeId: assigneeId || undefined,
        createdById: user.id,
        priority,
        dueDate: dueDate ? parseDateInput(dueDate) : undefined,
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
  } catch (err) {
    console.error("POST /api/tasks failed:", err);
    return NextResponse.json({ error: "Could not create task" }, { status: 500 });
  }
}
