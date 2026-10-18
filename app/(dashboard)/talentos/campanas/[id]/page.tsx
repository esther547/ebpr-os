import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canApproveCampaigns, canUseTalents } from "@/lib/talents";
import { SuggestionSchema } from "@/lib/campaign-suggester";
import { PageHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SuggestionView, STATUS } from "@/components/talents/suggestion-view";
import { CampaignDecision } from "@/components/talents/campaign-decision";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!canUseTalents(user) && !canApproveCampaigns(user)) redirect("/dashboard");
  const row = await db.campaignSuggestion.findUnique({ where: { id: params.id }, include: { createdBy: { select: { name: true } } } });
  if (!row) notFound();
  const s = SuggestionSchema.safeParse(row.result);
  if (!s.success) notFound();
  const decider = row.decidedById ? await db.user.findUnique({ where: { id: row.decidedById }, select: { name: true } }) : null;
  const st = STATUS[row.status] ?? { label: row.status, tone: "neutral" as const };
  return (
    <>
      <PageHeader eyebrow="Propuesta de campaña" title={row.brand} subtitle={`Preparada por ${row.createdBy.name} · ${formatDateTime(row.createdAt)}${row.brief ? ` · ${row.brief}` : ""}`} breadcrumbs={[{ label: "Talentos", href: "/talentos" }, { label: "Campañas", href: "/talentos/campanas" }, { label: row.brand }]} />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={st.tone}>{st.label}</Badge>
        {row.sentAt && <span className="text-ink-muted">Enviada {formatDateTime(row.sentAt)} a {row.sentTo.join(", ")}</span>}
        {row.decidedAt && <span className="text-ink-muted">· {row.status === "APPROVED" ? "Aprobada" : "Rechazada"} por {decider?.name ?? "—"} {formatDateTime(row.decidedAt)}</span>}
      </div>
      {row.decisionNote && <p className="mb-4 rounded-md border border-border bg-white px-4 py-3 text-sm"><span className="font-semibold">Nota:</span> {row.decisionNote}</p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card><SuggestionView s={s.data} /></Card>
        <div><CampaignDecision id={row.id} status={row.status} canApprove={canApproveCampaigns(user)} /></div>
      </div>
    </>
  );
}
