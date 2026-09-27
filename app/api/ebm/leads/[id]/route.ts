import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, canAccessEbm, leadSelect } from "@/lib/ebm";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  brand: z.string().trim().min(1).max(200).optional(),
  clientId: z.string().nullable().optional(),
  ownerId: z.string().min(1).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  contactName: z.string().trim().max(200).nullable().optional(),
  contactInfo: z.string().trim().max(500).nullable().optional(),
  nextStep: z.string().trim().max(500).nullable().optional(),
  nextFollowUpAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  /** Optional note written together with a status change. */
  note: z.string().trim().max(2000).optional(),
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const existing = await db.brandLead.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  const data: Prisma.BrandLeadUncheckedUpdateInput = {};
  if (d.brand !== undefined) data.brand = d.brand;
  if (d.contactName !== undefined) data.contactName = d.contactName || null;
  if (d.contactInfo !== undefined) data.contactInfo = d.contactInfo || null;
  if (d.nextStep !== undefined) data.nextStep = d.nextStep || null;
  if (d.notes !== undefined) data.notes = d.notes || null;
  if (d.nextFollowUpAt !== undefined) data.nextFollowUpAt = d.nextFollowUpAt ? new Date(`${d.nextFollowUpAt}T12:00:00Z`) : null;
  if (d.clientId !== undefined) {
    const clientId = d.clientId || null;
    if (clientId) {
      const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) return NextResponse.json({ error: "Artista no encontrado" }, { status: 400 });
    }
    data.clientId = clientId;
  }
  if (d.ownerId !== undefined) {
    const owner = await db.user.findUnique({ where: { id: d.ownerId }, select: { id: true } });
    if (!owner) return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 400 });
    data.ownerId = d.ownerId;
  }
  const statusChanged = d.status !== undefined && d.status !== existing.status;
  if (d.status !== undefined) {
    data.status = d.status;
    data.closedAt = d.status === "WON" || d.status === "LOST" ? new Date() : null;
  }
  if (statusChanged || d.note) {
    data.updates = {
      create: {
        authorId: auth.user.id,
        text: d.note || `Pasó a ${LEAD_STATUS_LABELS[d.status!]}`,
        status: statusChanged ? d.status : null,
      },
    };
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No hay nada que actualizar" }, { status: 400 });
  try {
    const lead = await db.brandLead.update({ where: { id }, data, select: leadSelect });
    return NextResponse.json({ data: lead });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    console.error("PATCH /api/ebm/leads/[id]", err);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    await db.brandLead.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  }
}
