import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  INVALID_BODY,
  authorizePriorities,
  badRequest,
  dedupeKey,
  isValidDayKey,
  readJsonBody,
  resolveWeekKey,
  weekOfInstant,
  zodMessage,
} from "@/lib/priorities";

export const dynamic = "force-dynamic";

const schema = z.object({
  fromWeek: z.string().min(1, "Falta la semana de origen"),
  toWeek: z.string().min(1, "Falta la semana de destino"),
  list: z.enum(["TEAM", "ESTHER", "CAROLINA"]).optional(),
});

/**
 * POST /api/priorities/carry-over — copy every unfinished line from one week to
 * another. A line whose title already exists for that client in the target week
 * is skipped, so running it twice is harmless.
 */
export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  if (body === INVALID_BODY) return badRequest("El cuerpo de la petición no es JSON válido");

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: zodMessage(parsed.error.issues), details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const list = parsed.data.list ?? "TEAM";
  const auth = await authorizePriorities(list);
  if (auth.error) return auth.error;

  const { fromWeek, toWeek } = parsed.data;
  if (!isValidDayKey(fromWeek) || !isValidDayKey(toWeek)) {
    return badRequest("Las semanas deben tener el formato yyyy-MM-dd");
  }

  const fromKey = resolveWeekKey(fromWeek);
  const toKey = resolveWeekKey(toWeek);
  if (fromKey === toKey) return badRequest("Las semanas de origen y destino son la misma");

  const fromWeekOf = weekOfInstant(fromKey);
  const toWeekOf = weekOfInstant(toKey);

  const [pending, target] = await Promise.all([
    db.weeklyPriority.findMany({
      where: { weekOf: fromWeekOf, isDone: false, list },
      select: { clientId: true, title: true, notes: true, assigneeId: true, order: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    db.weeklyPriority.findMany({
      where: { weekOf: toWeekOf, list },
      select: { clientId: true, title: true, order: true },
    }),
  ]);

  const seen = new Set(target.map((t) => dedupeKey(t.clientId, t.title)));
  // Next free slot at the bottom of each list in the target week.
  const nextOrder = new Map<string, number>();
  for (const t of target) {
    const key = t.clientId ?? "";
    nextOrder.set(key, Math.max(nextOrder.get(key) ?? 0, t.order + 1));
  }

  const rows: {
    weekOf: Date;
    list: string;
    clientId: string | null;
    title: string;
    notes: string | null;
    assigneeId: string | null;
    order: number;
    createdById: string;
  }[] = [];

  for (const item of pending) {
    const key = dedupeKey(item.clientId, item.title);
    if (seen.has(key)) continue;
    seen.add(key);
    const listKey = item.clientId ?? "";
    const order = nextOrder.get(listKey) ?? 0;
    nextOrder.set(listKey, order + 1);
    rows.push({
      weekOf: toWeekOf,
      list,
      clientId: item.clientId,
      title: item.title,
      notes: item.notes,
      assigneeId: item.assigneeId,
      order,
      createdById: auth.user.id,
    });
  }

  if (rows.length > 0) await db.weeklyPriority.createMany({ data: rows });

  return NextResponse.json({
    data: { count: rows.length, skipped: pending.length - rows.length, fromWeek: fromKey, toWeek: toKey },
  });
}
