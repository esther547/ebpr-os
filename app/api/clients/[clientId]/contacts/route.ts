import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageClients } from "@/lib/permissions";

const schema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email("Email inválido"), role: z.string().trim().max(80).optional().nullable(), notifyAgenda: z.boolean().optional() });

/** POST — add a contact (and, by default, make it receive the agenda emails). */
export async function POST(req: NextRequest, { params }: { params: { clientId: string } }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!canManageClients(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const contact = await db.contact.create({ data: { clientId: params.clientId, name: d.name, email: d.email, role: d.role || null, notifyAgenda: d.notifyAgenda ?? true } });
  return NextResponse.json({ data: contact }, { status: 201 });
}
