import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.notification.count({
      where: { userId: user.id, isRead: false },
    }),
  ]);

  return NextResponse.json(
    { data: notifications, unreadCount },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
