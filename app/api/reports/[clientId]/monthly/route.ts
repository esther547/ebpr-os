import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { currentMonthYearInTz } from "@/components/runners/miami-time";

// Next 14: route params are a plain object (not a Promise)
type Params = { params: { clientId: string } };

function parseMonthYear(searchParams: URLSearchParams): { month: number; year: number } | null {
  const current = currentMonthYearInTz();
  const month = Number(searchParams.get("month") ?? current.month);
  const year = Number(searchParams.get("year") ?? current.year);
  const valid =
    Number.isInteger(month) && month >= 1 && month <= 12 &&
    Number.isInteger(year) && year >= 2000 && year <= 2100;
  return valid ? { month, year } : null;
}

export async function GET(req: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewReports(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = parseMonthYear(searchParams);
  if (!period) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }
  const { month, year } = period;

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, name: true, monthlyTarget: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const deliverables = await db.deliverable.findMany({
    where: { clientId: params.clientId, month, year, status: { not: "CANCELLED" } },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      outcome: true,
      completedAt: true,
      dueDate: true,
      isClientVisible: true,
      assignee: { select: { name: true } },
    },
    orderBy: [{ completedAt: "desc" }, { createdAt: "asc" }],
  });

  const completed = deliverables.filter((d) => d.status === "COMPLETED");

  // Media breakdown of completed deliverables by type
  const mediaBreakdown: Record<string, number> = {};
  for (const d of completed) {
    mediaBreakdown[d.type] = (mediaBreakdown[d.type] ?? 0) + 1;
  }

  return NextResponse.json({
    data: {
      client,
      month,
      year,
      target: client.monthlyTarget,
      total: deliverables.length,
      completed: completed.length,
      inProgress: deliverables.length - completed.length,
      completionRate:
        client.monthlyTarget > 0
          ? Math.round((completed.length / client.monthlyTarget) * 100)
          : 0,
      mediaBreakdown,
      deliverables,
      wins: completed.filter((d) => d.outcome),
      exportUrl: `/api/reports/${client.id}/export?month=${month}&year=${year}`,
    },
  });
}
