import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  content: z.string().min(1),
  isInternal: z.boolean().optional(),
});

// GET — list all comments for a deliverable
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const comments = await db.comment.findMany({
    where: { deliverableId: id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: comments });
}

// POST — create a comment
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const comment = await db.comment.create({
    data: {
      deliverableId: id,
      userId: user.id,
      content: parsed.data.content,
      isInternal: parsed.data.isInternal ?? true,
    },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  // Notify the deliverable's assignee and team
  const deliverable = await db.deliverable.findUnique({
    where: { id },
    select: { title: true, clientId: true, assigneeId: true },
  });

  if (deliverable) {
    // Notify assignee if different from commenter
    if (deliverable.assigneeId && deliverable.assigneeId !== user.id) {
      await db.notification.create({
        data: {
          userId: deliverable.assigneeId,
          title: "New Comment",
          message: `${user.name} commented on "${deliverable.title}"`,
          type: "comment_added",
          link: `/clients/${deliverable.clientId}/deliverables/${id}`,
        },
      });
    }
  }

  return NextResponse.json({ data: comment }, { status: 201 });
}
