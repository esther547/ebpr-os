import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canUseTalents } from "@/lib/talents";
import { SuggestionSchema } from "@/lib/campaign-suggester";
import { PageHeader } from "@/components/layout/header";
import { TalentsTabs } from "@/components/talents/talents-tabs";
import { CampaignsClient, type CampaignRow } from "@/components/talents/campaigns-client";

export const dynamic = "force-dynamic";

export default async function CampanasPage() {
  const user = await requireUser();
  if (!canUseTalents(user)) redirect("/dashboard");
  const [rows, talentCount] = await Promise.all([
    db.campaignSuggestion.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { createdBy: { select: { id: true, name: true } } } }),
    db.talent.count({ where: { isActive: true } }),
  ]);
  const campaigns: CampaignRow[] = rows.flatMap((r) => { const s = SuggestionSchema.safeParse(r.result); return s.success ? [{ id: r.id, brand: r.brand, brief: r.brief, status: r.status, createdAt: r.createdAt.toISOString(), sentAt: r.sentAt?.toISOString() ?? null, decidedAt: r.decidedAt?.toISOString() ?? null, decisionNote: r.decisionNote, createdBy: r.createdBy.id === user.id ? "Tú" : r.createdBy.name, result: s.data }] : []; });
  return (
    <>
      <PageHeader title="Talentos" subtitle="Escribe una marca y el sistema propone talentos y campaña con el roster. Esther y Benjy aprueban antes de que algo llegue a la marca." />
      <TalentsTabs current="/talentos/campanas" campaigns={rows.filter((r) => r.status === "SENT").length || undefined} />
      <CampaignsClient campaigns={campaigns} talentCount={talentCount} meId="Tú" isAdmin={user.role === "SUPER_ADMIN"} />
    </>
  );
}
