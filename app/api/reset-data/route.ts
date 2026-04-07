import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Temporary endpoint to reset all data except the current user
// DELETE THIS FILE after use
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify the user is SUPER_ADMIN
  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Must be SUPER_ADMIN" }, { status: 403 });
  }

  // Delete in order to respect foreign keys
  const results: Record<string, number> = {};

  results.payments = (await db.payment.deleteMany()).count;
  results.invoices = (await db.invoice.deleteMany()).count;
  results.approvalResponses = (await db.approvalResponse.deleteMany()).count;
  results.approvals = (await db.approval.deleteMany()).count;
  results.comments = (await db.comment.deleteMany()).count;
  results.activityLogs = (await db.activityLog.deleteMany()).count;
  results.files = (await db.file.deleteMany()).count;
  results.tasks = (await db.task.deleteMany()).count;
  results.deliverables = (await db.deliverable.deleteMany()).count;
  results.runnerAssignments = (await db.runnerAssignment.deleteMany()).count;
  results.runnerAvailability = (await db.runnerAvailability.deleteMany()).count;
  results.strategyItems = (await db.strategyItem.deleteMany()).count;
  results.strategyDocuments = (await db.strategyDocument.deleteMany()).count;
  results.campaigns = (await db.campaign.deleteMany()).count;
  results.checklistItems = (await db.onboardingChecklistItem.deleteMany()).count;
  results.onboardings = (await db.onboarding.deleteMany()).count;
  results.contracts = (await db.contract.deleteMany()).count;
  results.contacts = (await db.contact.deleteMany()).count;
  results.clientUsers = (await db.clientUser.deleteMany()).count;
  results.reports = (await db.report.deleteMany()).count;
  results.clients = (await db.client.deleteMany()).count;

  // Delete all users EXCEPT the current one
  results.otherUsers = (await db.user.deleteMany({
    where: { id: { not: user.id } },
  })).count;

  return NextResponse.json({
    message: "All data cleared. Only your user account remains.",
    kept: { id: user.id, name: user.name, email: user.email, role: user.role },
    deleted: results,
  });
}
