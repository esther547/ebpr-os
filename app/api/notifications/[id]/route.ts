import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Mark notification as read
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  await db.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return NextResponse.json({ message: "Marked as read" });
}
