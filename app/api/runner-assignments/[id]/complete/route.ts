import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  notes: z.string().trim().max(5000).optional().nullable(),
});

// Next 14: route params are a plain object (not a Promise)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const { id } = params;

  // Body is optional; an empty/invalid body must not 500
  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
  }
  const notes = parsed.data.notes || undefined;

  const assignment = await db.runnerAssignment.findUnique({ where: { id } });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  // Runners may only complete their own assignments
  if (user.role === "RUNNER" && assignment.runnerId !== user.id) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  if (assignment.status === "CANCELLED") {
    return NextResponse.json({ error: "This assignment was cancelled" }, { status: 409 });
  }
  if (assignment.status === "COMPLETED") {
    // Idempotent: already done
    return NextResponse.json({ message: "Assignment already completed" });
  }

  // Mark assignment as completed
  await db.runnerAssignment.update({
    where: { id },
    data: {
      status: "COMPLETED",
      notes: notes
        ? assignment.notes
          ? `${assignment.notes}\n\n--- Post-Event Notes ---\n${notes}`
          : `Post-Event Notes: ${notes}`
        : assignment.notes,
    },
  });

  // If linked to a deliverable, update deliverable status too
  if (assignment.deliverableId) {
    const deliverable = await db.deliverable.findUnique({
      where: { id: assignment.deliverableId },
      select: { id: true, status: true },
    });
    if (deliverable && deliverable.status !== "COMPLETED" && deliverable.status !== "CANCELLED") {
      await db.deliverable.update({
        where: { id: deliverable.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }

    // Add comment to deliverable with runner's notes (internal)
    if (deliverable && notes) {
      await db.comment.create({
        data: {
          deliverableId: deliverable.id,
          userId: user.id,
          content: `Runner completed: ${notes}`,
          isInternal: true,
        },
      });
    }
  }

  // Log activity
  if (assignment.clientId) {
    await db.activityLog.create({
      data: {
        clientId: assignment.clientId,
        deliverableId: assignment.deliverableId ?? undefined,
        userId: user.id,
        action: "assignment_completed",
        description: `Runner completed: ${assignment.eventName}`,
        metadata: { assignmentId: assignment.id, notes: notes ?? null },
      },
    });
  }

  // Let the team know (status visible to strategists/admins)
  const team = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "STRATEGIST"] }, isActive: true, id: { not: user.id } },
    select: { id: true },
  });
  if (team.length > 0) {
    await db.notification.createMany({
      data: team.map((t) => ({
        userId: t.id,
        title: "Assignment Completed",
        message: `${user.name} completed "${assignment.eventName}"${notes ? ` — ${notes}` : ""}`.slice(0, 500),
        type: "assignment_completed",
        link: assignment.clientId
          ? `/clients/${assignment.clientId}/agenda?assignment=${assignment.id}`
          : `/runners/schedule?assignment=${assignment.id}`,
      })),
    });
  }

  return NextResponse.json({ message: "Assignment marked as completed" });
}
