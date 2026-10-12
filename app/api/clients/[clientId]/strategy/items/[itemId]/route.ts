import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { syncStrategyTodo } from "@/lib/strategy-todo";
import { STRATEGIST_ROLES } from "@/lib/strategist-report";

export const dynamic = "force-dynamic";

const schema = z.object({ assigneeId: z.string().trim().min(1).nullable().optional() });

/** PATCH { assigneeId } — who is in charge of a strategy item / client wish; mirrored on their to-dos. */
export async function PATCH(req: NextRequest, { params }: { params: { clientId: string; itemId: string } }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageClients(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const item = await db.strategyItem.findFirst({ where: { id: params.itemId, clientId: params.clientId }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Elemento no encontrado" }, { status: 404 });
  if (parsed.data.assigneeId) {
    const u = await db.user.findUnique({ where: { id: parsed.data.assigneeId }, select: { role: true, isActive: true } });
    if (!u || !u.isActive || !STRATEGIST_ROLES.includes(u.role)) return NextResponse.json({ error: "Elige un estratega activo" }, { status: 400 });
  }
  const saved = await db.strategyItem.update({ where: { id: item.id }, data: { assigneeId: parsed.data.assigneeId ?? null }, select: { id: true, assigneeId: true } });
  await syncStrategyTodo(item.id, user.id).catch((err) => console.error("syncStrategyTodo:", err));
  return NextResponse.json(saved);
}
