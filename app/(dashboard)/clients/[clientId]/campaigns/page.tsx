import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientHeader } from "@/components/clients/client-header";
import { CampaignList } from "@/components/campaigns/campaign-list";

type Props = { params: Promise<{ clientId: string }> };

export const metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

export default async function CampaignsPage({ params }: Props) {
  await requireUser();
  const { clientId } = await params;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, status: true, monthlyTarget: true, industry: true, cycleDay: true, goalsOwed: true, focusNote: true, agendaDocUrl: true },
  });
  if (!client) notFound();

  const campaigns = await db.campaign.findMany({
    where: { clientId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { deliverables: true, tasks: true, strategyItems: true } },
    },
  });

  const teamMembers = await db.user.findMany({
    where: {
      role: { in: ["SUPER_ADMIN", "STRATEGIST"] },
      isActive: true,
    },
    select: { id: true, name: true },
  });

  return (
    <>
      <ClientHeader client={client} counts={{ campaigns: campaigns.length }} />
      <CampaignList campaigns={campaigns} clientId={clientId} teamMembers={teamMembers} />
    </>
  );
}
