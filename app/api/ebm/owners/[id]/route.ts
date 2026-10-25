import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeOwner, itemSchema, itemSelect, serializeItem } from "@/lib/ebm-owners";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeOwner();
  if (auth.error) return auth.error;
  const cur = await db.ownerItem.findUnique({ where: { id: params.id }, select: { id: true, status: true } });
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = itemSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  const d = parsed.data;
  const data: Record<string, unknown> = { ...d };
  if (d.dueAt !== undefined) data.dueAt = d.dueAt ? new Date(`${d.dueAt}T12:00:00Z`) : null;
  if (d.status && d.status !== cur.status) {
    data.resolvedAt = d.status === "DONE" ? new Date() : null;
    data.updates = { create: { authorId: auth.user.id, text: `Status → ${d.status.replace(/_/g, " ").toLowerCase()}`, status: d.status } };
  }
  const row = await db.ownerItem.update({ where: { id: cur.id }, select: itemSelect, data });
  return NextResponse.json({ data: serializeItem(row) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeOwner();
  if (auth.error) return auth.error;
  await db.ownerItem.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
