import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEAD_STATUSES, canAccessEbm, leadSelect } from "@/lib/ebm";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  brand: z.string().trim().min(1, "Escribe la marca").max(200),
  clientId: z.string().min(1).nullable().optional(),
  ownerId: z.string().min(1).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  contactName: z.string().trim().max(200).nullable().optional(),
  contactInfo: z.string().trim().max(500).nullable().optional(),
  nextStep: z.string().trim().max(500).nullable().optional(),
  nextFollowUpAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

async function authorize() {
  try {
    const user = await requireUser();
    if (!canAccessEbm(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { user };
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const data = await db.brandLead.findMany({ select: leadSelect, orderBy: [{ updatedAt: "desc" }] });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const ownerId = d.ownerId ?? auth.user.id;
  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { id: true } });
  if (!owner) return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 400 });
  if (d.clientId) {
    const client = await db.client.findUnique({ where: { id: d.clientId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Artista no encontrado" }, { status: 400 });
  }
  const status = d.status ?? "PROSPECT";
  const lead = await db.brandLead.create({
    data: {
      brand: d.brand,
      clientId: d.clientId ?? null,
      ownerId,
      status,
      contactName: d.contactName || null,
      contactInfo: d.contactInfo || null,
      nextStep: d.nextStep || null,
      nextFollowUpAt: d.nextFollowUpAt ? new Date(`${d.nextFollowUpAt}T12:00:00Z`) : null,
      notes: d.notes || null,
      closedAt: status === "WON" || status === "LOST" ? new Date() : null,
      createdById: auth.user.id,
      updates: { create: { authorId: auth.user.id, text: "Lead creado", status } },
    },
    select: leadSelect,
  });
  return NextResponse.json({ data: lead }, { status: 201 });
}
