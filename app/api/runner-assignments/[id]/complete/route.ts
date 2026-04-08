import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const body = await req.json();
  const notes = body.notes as string | undefined;

  const assignment = await db.runnerAssignment.findUnique({ where: { id } });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  // Mark assignment as completed
  await db.runnerAssignment.update({
    where: { id },
    data: {
      status: "COMPLETED",
      notes: notes ? (assignment.notes ? `${assignment.notes}\n\n--- Post-Event Notes ---\n${notes}` : `Post-Event Notes: ${notes}`) : assignment.notes,
    },
  });

  // If linked to a deliverable, update deliverable status too
  if (assignment.deliverableId) {
    await db.deliverable.update({
      where: { id: assignment.deliverableId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    // Add comment to deliverable with runner's notes
    if (notes) {
      await db.comment.create({
        data: {
          deliverableId: assignment.deliverableId,
          userId: user.id,
          content: `Runner completed: ${notes}`,
        },
      });
    }
  }

  // Log activity
  if (assignment.clientId) {
    await db.activityLog.create({
      data: {
        clientId: assignment.clientId,
        userId: user.id,
        action: "assignment_completed",
        description: `Runner completed: ${assignment.eventName}`,
      },
    });
  }

  return NextResponse.json({ message: "Assignment marked as completed" });
}
