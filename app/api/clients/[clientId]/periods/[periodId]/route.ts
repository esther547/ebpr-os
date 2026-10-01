import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const canEdit = (role: string) => role === "SUPER_ADMIN" || role === "STRATEGIST";
const patchSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  refYear: z.number().int().min(2020).max(2100).optional(),
  refMonth: z.number().int().min(1).max(12).optional(),
  target: z.number().int().min(0).max(100).optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

async function own(clientId: string, periodId: string) {
  let user;
  try { user = await requireUser(); } catch { return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const; }
  if (!canEdit(user.role)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  const period = await db.servicePeriod.findFirst({ where: { id: periodId, clientId } });
  if (!period) return { error: NextResponse.json({ error: "Período no encontrado" }, { status: 404 }) } as const;
  return { user, period } as const;
}

/** PATCH — label, reference month, agreed goals, note. Changing the reference month re-tags the period's units' months. */
export async function PATCH(req: NextRequest, { params }: { params: { clientId: string; periodId: string } }) {
  const o = await own(params.clientId, params.periodId);
  if ("error" in o) return o.error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const period = await db.servicePeriod.update({ where: { id: o.period.id }, data: d });
  if (d.refYear !== undefined || d.refMonth !== undefined) {
    await db.runnerAssignment.updateMany({ where: { periodId: period.id }, data: { agendaYear: period.refYear, agendaMonth: period.refMonth } });
    await db.deliverable.updateMany({ where: { periodId: period.id }, data: { year: period.refYear, month: period.refMonth, monthPinned: true } });
  }
  return NextResponse.json({ data: period });
}

/** DELETE — only an empty period; later periods are renumbered so numbering stays consecutive. */
export async function DELETE(_req: NextRequest, { params }: { params: { clientId: string; periodId: string } }) {
  const o = await own(params.clientId, params.periodId);
  if ("error" in o) return o.error;
  const [p, g] = await Promise.all([db.runnerAssignment.count({ where: { periodId: o.period.id } }), db.deliverable.count({ where: { periodId: o.period.id } })]);
  if (p + g > 0) return NextResponse.json({ error: "El período tiene metas; muévelas antes de borrarlo" }, { status: 409 });
  await db.servicePeriod.delete({ where: { id: o.period.id } });
  const later = await db.servicePeriod.findMany({ where: { clientId: params.clientId, number: { gt: o.period.number } }, orderBy: { number: "asc" } });
  for (const l of later) await db.servicePeriod.update({ where: { id: l.id }, data: { number: l.number - 1 } });
  return NextResponse.json({ data: { id: o.period.id } });
}
