import { notFound } from "next/navigation";
import Link from "next/link";
import { Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientHeader } from "@/components/clients/client-header";
import { availabilityNowFor } from "@/lib/client-availability";
import { StrategyDocumentCard } from "@/components/strategy/strategy-document-card";
import { StrategyPhaseBanner } from "@/components/strategy/strategy-phase-banner";
import { StrategyBigWins } from "@/components/strategy/strategy-big-wins";
import { ClientWishlist } from "@/components/strategy/client-wishlist";
import { StrategyBrandDeals } from "@/components/strategy/strategy-brand-deals";
import { StrategyOutletList } from "@/components/strategy/strategy-outlet-list";
import { StrategyWorkflowTable } from "@/components/strategy/strategy-workflow-table";
import { StrategyEventsList } from "@/components/strategy/strategy-events-list";
import { StrategyDocLink } from "@/components/strategy/strategy-doc-link";
import { StrategyAddItemButton } from "@/components/strategy/strategy-actions";
import { StrategyDocumentEditButton } from "@/components/strategy/strategy-document-modal";
import { Button } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";

type Props = { params: { clientId: string } };

export const metadata = { title: "Strategy" };
export const dynamic = "force-dynamic";

export default async function StrategyPage({ params }: Props) {
  await requireUser();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: {
      id: true,
      name: true,
      status: true,
      monthlyTarget: true,
      industry: true,
      strategyDocUrl: true,
    },
  });
  if (!client) notFound();
  const availabilityNow = await availabilityNowFor(client.id);

  // Strategy document
  const doc = await db.strategyDocument.findUnique({
    where: { clientId: params.clientId },
  });

  // All strategy items
  const items = await db.strategyItem.findMany({
    where: { clientId: params.clientId },
    orderBy: [{ priority: "desc" }, { scheduledDate: "asc" }, { createdAt: "desc" }],
  });

  // Tasks (workflow section)
  const tasks = await db.task.findMany({
    where: { clientId: params.clientId },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      assignee: { select: { id: true, name: true } },
    },
  });

  // Categorize items
  const clientWishlist = [...items.filter((i) => i.source === "CLIENT")].sort((a, b) => new Date(b.requestedAt ?? b.createdAt).getTime() - new Date(a.requestedAt ?? a.createdAt).getTime());
  const bigWins = items.filter((i) => i.isBigWin);
  const brandDeals = items.filter((i) => i.category === "BRAND_OPPORTUNITY");
  const mediaTargets = items.filter((i) => i.category === "MEDIA_TARGET" && !i.isBigWin);
  const influencers = items.filter((i) => i.category === "INFLUENCER");
  const events = items.filter((i) => i.category === "EVENT");
  const positioning = items.filter((i) => i.category === "POSITIONING");

  // Group brand deals by brandCategory (plain array of entries — safe to pass to a client component)
  const brandDealsByCategory = new Map<string, typeof brandDeals>();
  for (const item of brandDeals) {
    const cat = item.brandCategory ?? "Other";
    const arr = brandDealsByCategory.get(cat) ?? [];
    arr.push(item);
    brandDealsByCategory.set(cat, arr);
  }
  const brandDealGroups = Array.from(brandDealsByCategory.entries()).map(([category, items]) => ({
    category,
    items,
  }));

  const totalItems = items.length;

  return (
    <>
      <ClientHeader availabilityNow={availabilityNow}
        client={client}
        counts={{ strategy: totalItems }}
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/clients/${client.id}/strategy/brief`}>View Brief</Link>
            </Button>
            <StrategyAddItemButton clientId={client.id} />
          </>
        }
      />

      <div className="space-y-6">
        {/* Google Doc Link */}
        <StrategyDocLink clientId={client.id} strategyDocUrl={client.strategyDocUrl} />

        {/* Strategy document brief */}
        {doc ? (
          <StrategyDocumentCard doc={doc} clientId={client.id} />
        ) : (
          <EmptyState
            compact
            icon={<Target />}
            title="No strategy brief yet"
            description="Add the client objective, messaging, and phase structure."
            action={
              <StrategyDocumentEditButton clientId={client.id} doc={null}>
                Create Strategy Brief
              </StrategyDocumentEditButton>
            }
          />
        )}

        {/* Phase banners */}
        {doc && (doc.phase1Name || doc.phase2Name) && <StrategyPhaseBanner doc={doc} />}

        <ClientWishlist clientId={client.id} items={clientWishlist} />

        {bigWins.length > 0 && <StrategyBigWins items={bigWins} />}

        {brandDeals.length > 0 && <StrategyBrandDeals groups={brandDealGroups} />}

        {mediaTargets.length > 0 && (
          <StrategyOutletList title="Press & Media Targets" items={mediaTargets} category="MEDIA_TARGET" />
        )}

        {influencers.length > 0 && (
          <StrategyOutletList title="Influencer Targets" items={influencers} category="INFLUENCER" />
        )}

        {events.length > 0 && <StrategyEventsList items={events} />}

        {positioning.length > 0 && (
          <StrategyOutletList title="Positioning Angles" items={positioning} category="POSITIONING" />
        )}

        {tasks.length > 0 && <StrategyWorkflowTable tasks={tasks} />}

        {/* Empty state */}
        {totalItems === 0 && !doc && (
          <EmptyState
            icon={<Target />}
            title="Strategy wishlist is empty"
            description="Build the preparation month wishlist — media targets, influencers, events, brand deals."
          />
        )}
      </div>
    </>
  );
}
