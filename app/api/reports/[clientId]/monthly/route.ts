import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";

type Params = { params: { clientId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    if (!canViewReports(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

    const client = await db.client.findUnique({
      where: { id: params.clientId },
      select: { id: true, name: true, monthlyTarget: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const deliverables = await db.deliverable.findMany({
      where: { clientId: params.clientId, month, year },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        outcome: true,
        completedAt: true,
        assignee: { select: { name: true } },
      },
    });

    const completed = deliverables.filter((d) => d.status === "COMPLETED");

    return NextResponse.json({
      data: {
        client,
        month,
        year,
        target: client.monthlyTarget,
        total: deliverables.length,
        completed: completed.length,
        completionRate:
          client.monthlyTarget > 0
            ? Math.round((completed.length / client.monthlyTarget) * 100)
            : 0,
        deliverables,
        wins: completed.filter((d) => d.outcome),
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
