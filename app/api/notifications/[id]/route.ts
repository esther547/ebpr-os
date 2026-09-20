import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Mark notification as read.
// Next 14: route params are a plain object (not a Promise).
export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const { id } = params;

  // Scope to the caller so nobody can mark another user's notification as read
  const result = await db.notification.updateMany({
    where: { id, userId: user.id },
    data: { isRead: true },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Marked as read" });
}
