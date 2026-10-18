import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canUseTalents } from "@/lib/talents";
import { PageHeader } from "@/components/layout/header";
import { TalentsTabs } from "@/components/talents/talents-tabs";
import { TalentsClient } from "@/components/talents/talents-client";

export const dynamic = "force-dynamic";

export default async function TalentosPage() {
  const user = await requireUser();
  if (!canUseTalents(user)) redirect("/dashboard");
  const [talents, campaigns] = await Promise.all([
    db.talent.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.campaignSuggestion.count({ where: { status: "SENT" } }),
  ]);
  return (
    <>
      <PageHeader title="Talentos" subtitle="El roster de EBM y la lista de Esther en un solo lugar: quién está en retainer, quién fuera y a quién podemos llegar para brand deals." />
      <TalentsTabs current="/talentos" campaigns={campaigns || undefined} />
      <TalentsClient talents={talents.map((t) => ({ ...t, createdAt: undefined, updatedAt: undefined, lastVerifiedAt: t.lastVerifiedAt ? t.lastVerifiedAt.toISOString() : null }))} />
    </>
  );
}
