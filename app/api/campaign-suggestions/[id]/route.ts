import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canApproveCampaigns, canUseTalents } from "@/lib/talents";
import { SuggestionSchema } from "@/lib/campaign-suggester";
import { sendCampaignForApproval } from "@/lib/campaign-email";

const schema = z.object({ action: z.enum(["send", "approve", "reject", "delete"]), note: z.string().trim().max(2000).optional().nullable() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseTalents(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  const row = await db.campaignSuggestion.findUnique({ where: { id: params.id }, include: { createdBy: { select: { name: true, email: true } } } });
  if (!row) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const { action, note } = parsed.data;
  if (action === "send") {
    const suggestion = SuggestionSchema.safeParse(row.result);
    if (!suggestion.success) return NextResponse.json({ error: "La propuesta guardada está corrupta." }, { status: 500 });
    const sent = await sendCampaignForApproval({ id: row.id, brand: row.brand, brief: row.brief, suggestion: suggestion.data, byName: user.name, byEmail: user.email });
    if (!sent.ok) return NextResponse.json({ error: "No se pudo enviar el correo (revisa Settings → Correo)." }, { status: 502 });
    const updated = await db.campaignSuggestion.update({ where: { id: row.id }, data: { status: "SENT", sentTo: sent.to, sentAt: new Date() } });
    return NextResponse.json({ campaign: updated });
  }
  if (action === "delete") {
    if (row.createdById !== user.id && user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Solo quien la creó puede borrarla." }, { status: 403 });
    await db.campaignSuggestion.delete({ where: { id: row.id } });
    return NextResponse.json({ ok: true });
  }
  if (!canApproveCampaigns(user)) return NextResponse.json({ error: "Solo Esther o Benjy aprueban propuestas." }, { status: 403 });
  const updated = await db.campaignSuggestion.update({ where: { id: row.id }, data: { status: action === "approve" ? "APPROVED" : "REJECTED", decidedById: user.id, decidedAt: new Date(), decisionNote: note || null } });
  return NextResponse.json({ campaign: updated });
}
