import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { dayKeyInTz } from "@/components/runners/miami-time";
import { TYPE_LABELS_ES, isValidDayKey, loadClosedGoals, resolveRange } from "@/lib/strategist-report";

export const dynamic = "force-dynamic";

const MAX_DAYS = 400;

function csvCell(value: string): string {
  // Neutralise spreadsheet formulas and quote every cell.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * GET /api/reports/strategists/export?from=yyyy-MM-dd&to=yyyy-MM-dd
 * Goals closed (completedAt, Miami days, both ends inclusive) as CSV:
 * estratega, cliente, meta, tipo, fecha cierre. Defaults to the current Miami week.
 */
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewReports(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const fromParam = sp.get("from");
  const toParam = sp.get("to");
  let fromKey: string;
  let toKey: string;
  if (fromParam || toParam) {
    if (!isValidDayKey(fromParam) || !isValidDayKey(toParam)) {
      return NextResponse.json({ error: "from and to must be yyyy-MM-dd" }, { status: 400 });
    }
    if (fromParam > toParam) {
      return NextResponse.json({ error: "from must be on or before to" }, { status: 400 });
    }
    const days = (Date.parse(`${toParam}T00:00:00Z`) - Date.parse(`${fromParam}T00:00:00Z`)) / 86_400_000;
    if (days > MAX_DAYS) {
      return NextResponse.json({ error: `Range too long (max ${MAX_DAYS} days)` }, { status: 400 });
    }
    fromKey = fromParam;
    toKey = toParam;
  } else {
    const week = resolveRange({});
    fromKey = week.fromKey;
    toKey = week.toKey;
  }

  const goals = await loadClosedGoals(fromKey, toKey);
  const rows = goals
    .map((g) => ({
      strategist: g.closedBy?.name ?? "Sin estratega",
      unassigned: !g.closedBy,
      client: g.client.name,
      title: g.title,
      type: TYPE_LABELS_ES[g.type] ?? g.type,
      date: g.completedAt ? dayKeyInTz(g.completedAt) : "",
    }))
    .sort(
      (a, b) =>
        Number(a.unassigned) - Number(b.unassigned) ||
        a.strategist.localeCompare(b.strategist, "es") ||
        a.date.localeCompare(b.date) ||
        a.client.localeCompare(b.client, "es")
    );

  const lines = [
    ["Estratega", "Cliente", "Meta", "Tipo", "Fecha de cierre"].map(csvCell).join(","),
    ...rows.map((r) => [r.strategist, r.client, r.title, r.type, r.date].map(csvCell).join(",")),
  ];
  // BOM so Excel opens the accents correctly.
  const body = "﻿" + lines.join("\r\n") + "\r\n";
  const filename = `metas-por-estratega-${fromKey}-${toKey}.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
