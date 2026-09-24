import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canSeeInternalData } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canSeeInternalData(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const deliverableId = searchParams.get("deliverableId");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (deliverableId) where.deliverableId = deliverableId;

    const logs = await db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        client: { select: { id: true, name: true } },
        deliverable: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ data: logs });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
