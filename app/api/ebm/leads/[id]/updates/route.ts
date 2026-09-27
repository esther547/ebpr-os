import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canAccessEbm, leadSelect } from "@/lib/ebm";

export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().trim().min(1, "Write the update").max(2000) });

/** POST — add a note to the lead's log (what happened, what the brand said). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!canAccessEbm(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  const lead = await db.brandLead.findUnique({ where: { id }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await db.brandLeadUpdate.create({ data: { leadId: id, authorId: user.id, text: parsed.data.text } });
  const updated = await db.brandLead.update({ where: { id }, data: { updatedAt: new Date() }, select: leadSelect });
  return NextResponse.json({ data: updated }, { status: 201 });
}
