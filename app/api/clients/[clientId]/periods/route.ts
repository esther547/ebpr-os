import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { defaultLabel, listPeriods, periodBoard } from "@/lib/service-periods";

const canEdit = (role: string) => role === "SUPER_ADMIN" || role === "STRATEGIST";

/** GET — the client's periods with progress and the units still pending review. */
export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  try { await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const board = await periodBoard(params.clientId);
  return NextResponse.json({ data: board });
}

const createSchema = z.object({
  label: z.string().trim().max(60).optional(),
  refYear: z.number().int().min(2020).max(2100),
  refMonth: z.number().int().min(1).max(12),
  target: z.number().int().min(0).max(100),
  note: z.string().trim().max(500).optional().nullable(),
});

/** POST — add the next period (Mes N+1). Admins and strategists. */
export async function POST(req: NextRequest, { params }: { params: { clientId: string } }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!canEdit(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const existing = await listPeriods(params.clientId);
  const number = (existing[existing.length - 1]?.number ?? 0) + 1;
  const period = await db.servicePeriod.create({
    data: { clientId: params.clientId, number, label: d.label || defaultLabel(d.refYear, d.refMonth), refYear: d.refYear, refMonth: d.refMonth, target: d.target, note: d.note || null },
  });
  return NextResponse.json({ data: period }, { status: 201 });
}
