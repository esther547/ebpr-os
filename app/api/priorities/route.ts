import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  INVALID_BODY,
  authorizePriorities,
  badRequest,
  isPriorityListKey,
  isValidDayKey,
  priorityOrderBy,
  prioritySelect,
  readJsonBody,
  resolveWeekKey,
  weekOfInstant,
  zodMessage,
} from "@/lib/priorities";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  week: z.string().optional().nullable(),
  list: z.enum(["TEAM", "ESTHER", "CAROLINA"]).optional(),
  clientId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1, "El título es obligatorio").max(300),
  notes: z.string().trim().max(2000).nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
});

/** GET /api/priorities?week=yyyy-MM-dd — the list for one Miami week. */
export async function GET(req: NextRequest) {
  const listRaw = req.nextUrl.searchParams.get("list") ?? "TEAM";
  if (!isPriorityListKey(listRaw)) return badRequest("Lista desconocida");
  const auth = await authorizePriorities(listRaw);
  if (auth.error) return auth.error;

  const raw = req.nextUrl.searchParams.get("week");
  if (raw && !isValidDayKey(raw)) {
    return badRequest("La semana debe tener el formato yyyy-MM-dd");
  }

  const weekKey = resolveWeekKey(raw);
  const items = await db.weeklyPriority.findMany({
    where: { weekOf: weekOfInstant(weekKey), list: listRaw },
    select: prioritySelect,
    orderBy: priorityOrderBy,
  });

  return NextResponse.json({ data: items, week: weekKey, list: listRaw });
}

/** POST /api/priorities — add one line to a week (client-specific or general). */
export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  if (body === INVALID_BODY) return badRequest("El cuerpo de la petición no es JSON válido");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: zodMessage(parsed.error.issues), details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const list = parsed.data.list ?? "TEAM";
  const auth = await authorizePriorities(list);
  if (auth.error) return auth.error;

  const { week, title } = parsed.data;
  if (week && !isValidDayKey(week)) {
    return badRequest("La semana debe tener el formato yyyy-MM-dd");
  }

  const clientId = parsed.data.clientId ?? null;
  const assigneeId = parsed.data.assigneeId ?? null;

  if (clientId) {
    const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return badRequest("Cliente no encontrado");
  }
  if (assigneeId) {
    const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { id: true } });
    if (!assignee) return badRequest("Responsable no encontrado");
  }

  const weekOf = weekOfInstant(resolveWeekKey(week));
  const last = await db.weeklyPriority.aggregate({
    where: { weekOf, clientId, list },
    _max: { order: true },
  });

  const item = await db.weeklyPriority.create({
    data: {
      weekOf,
      list,
      clientId,
      title,
      notes: parsed.data.notes || null,
      assigneeId,
      order: (last._max.order ?? -1) + 1,
      createdById: auth.user.id,
    },
    select: prioritySelect,
  });

  return NextResponse.json({ data: item }, { status: 201 });
}
