import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageClients } from "@/lib/permissions";

const schema = z.object({ notifyAgenda: z.boolean().optional(), email: z.string().trim().email().optional(), name: z.string().trim().min(1).max(120).optional() });

async function own(clientId: string, contactId: string) {
  let user;
  try { user = await requireUser(); } catch { return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const; }
  if (!canManageClients(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  const contact = await db.contact.findFirst({ where: { id: contactId, clientId } });
  if (!contact) return { error: NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 }) } as const;
  return { contact } as const;
}

export async function PATCH(req: NextRequest, { params }: { params: { clientId: string; contactId: string } }) {
  const o = await own(params.clientId, params.contactId);
  if ("error" in o) return o.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const contact = await db.contact.update({ where: { id: o.contact.id }, data: parsed.data });
  return NextResponse.json({ data: contact });
}

export async function DELETE(_req: NextRequest, { params }: { params: { clientId: string; contactId: string } }) {
  const o = await own(params.clientId, params.contactId);
  if ("error" in o) return o.error;
  await db.contact.delete({ where: { id: o.contact.id } });
  return NextResponse.json({ data: { id: o.contact.id } });
}
