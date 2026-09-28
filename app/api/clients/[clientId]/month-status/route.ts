import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const schema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  isComplete: z.boolean(),
  note: z.string().trim().max(300).nullable().optional(),
});

/** PUT — mark (or unmark) a client's report month as complete by hand. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!canManageClients(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { clientId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const { year, month, isComplete, note } = parsed.data;
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  const row = await db.clientMonthOverride.upsert({
    where: { clientId_year_month: { clientId, year, month } },
    create: { clientId, year, month, isComplete, note: note || null, setById: user.id },
    update: { isComplete, note: note ?? undefined, setById: user.id },
  });
  await db.activityLog.create({
    data: { clientId, userId: user.id, action: "month_marked_complete", description: `${isComplete ? "Marcó" : "Desmarcó"} ${month}/${year} como completo para ${client.name}${note ? ` (${note})` : ""}` },
  }).catch(() => undefined);
  return NextResponse.json({ data: row });
}
