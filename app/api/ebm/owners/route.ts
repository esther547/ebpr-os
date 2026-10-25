import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeOwner, itemSchema, itemSelect, serializeItem } from "@/lib/ebm-owners";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeOwner();
  if (auth.error) return auth.error;
  const rows = await db.ownerItem.findMany({ select: itemSelect, orderBy: [{ updatedAt: "desc" }] });
  return NextResponse.json({ data: rows.map(serializeItem) });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeOwner();
  if (auth.error) return auth.error;
  const parsed = itemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  const d = parsed.data;
  const row = await db.ownerItem.create({ select: itemSelect, data: { title: d.title, category: d.category ?? "OTHER", status: d.status ?? "OPEN", waitingOn: d.waitingOn ?? null, handlerId: d.handlerId ?? null, leadId: d.leadId ?? null, nextStep: d.nextStep ?? null, dueAt: d.dueAt ? new Date(`${d.dueAt}T12:00:00Z`) : null, notes: d.notes ?? null, forWeekly: d.forWeekly ?? false, createdById: auth.user.id } });
  return NextResponse.json({ data: serializeItem(row) }, { status: 201 });
}
