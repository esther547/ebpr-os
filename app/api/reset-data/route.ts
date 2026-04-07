import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Temporary endpoint to clear fake deliverables + events only
// DELETE THIS FILE after use
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Must be SUPER_ADMIN" }, { status: 403 });
  }

  const results: Record<string, number> = {};

  // Clear deliverable-related data first (foreign keys)
  results.approvalResponses = (await db.approvalResponse.deleteMany()).count;
  results.approvals = (await db.approval.deleteMany({ where: { deliverableId: { not: null } } })).count;
  results.comments = (await db.comment.deleteMany({ where: { deliverableId: { not: null } } })).count;
  results.files = (await db.file.deleteMany({ where: { deliverableId: { not: null } } })).count;
  results.tasks = (await db.task.deleteMany({ where: { deliverableId: { not: null } } })).count;
  results.activityLogs = (await db.activityLog.deleteMany({ where: { deliverableId: { not: null } } })).count;

  // Delete all deliverables
  results.deliverables = (await db.deliverable.deleteMany()).count;

  // Delete all runner assignments (events)
  results.runnerAssignments = (await db.runnerAssignment.deleteMany()).count;
  results.runnerAvailability = (await db.runnerAvailability.deleteMany()).count;

  return NextResponse.json({
    message: "All deliverables and events cleared. Clients and everything else kept.",
    deleted: results,
  });
}
