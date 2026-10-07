import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageOutreach } from "@/lib/permissions";
import { db } from "@/lib/db";

const optText = z.string().trim().max(500).nullable().optional().transform((v) => (v === undefined ? undefined : v ? v : null));
const updateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").optional(),
  email: z.string().trim().toLowerCase().email("Email inválido").optional(),
  company: optText,
  role: optText,
  category: optText,
  phone: optText,
  city: optText,
  country: optText,
  notes: z.string().trim().max(5000).nullable().optional().transform((v) => (v === undefined ? undefined : v ? v : null)),
  tags: z.array(z.string().trim()).optional().transform((arr) => (arr === undefined ? undefined : Array.from(new Set(arr.filter(Boolean))))),
  isActive: z.boolean().optional(),
});
type Params = { params: { id: string } };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageOutreach(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const existing = await db.outreachContact.findUnique({ where: { id: params.id }, select: { id: true, email: true } });
  if (!existing) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  if (parsed.data.email && parsed.data.email !== existing.email) {
    const clash = await db.outreachContact.findFirst({ where: { id: { not: params.id }, email: parsed.data.email }, select: { name: true } });
    if (clash) return NextResponse.json({ error: `${clash.name} ya usa este email` }, { status: 409 });
  }
  const contact = await db.outreachContact.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageOutreach(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const existing = await db.outreachContact.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
  await db.outreachContact.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
