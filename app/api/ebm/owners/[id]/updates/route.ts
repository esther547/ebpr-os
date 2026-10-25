import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authorizeOwner, itemSelect, serializeItem } from "@/lib/ebm-owners";

export const dynamic = "force-dynamic";
const schema = z.object({ text: z.string().trim().min(1, "Write something").max(4000), discussed: z.boolean().optional() });

/** Add a note to an item; `discussed: true` also clears the "for weekly" flag. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeOwner();
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  const cur = await db.ownerItem.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await db.ownerItem.update({ where: { id: cur.id }, select: itemSelect, data: { ...(parsed.data.discussed ? { forWeekly: false } : {}), updates: { create: { authorId: auth.user.id, text: parsed.data.text } } } });
  return NextResponse.json({ data: serializeItem(row) });
}
