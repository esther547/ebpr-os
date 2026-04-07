import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { StrategyDocumentCard } from "@/components/strategy/strategy-document-card";
import { StrategyPhaseBanner } from "@/components/strategy/strategy-phase-banner";
import { StrategyBigWins } from "@/components/strategy/strategy-big-wins";
import { StrategyBrandDeals } from "@/components/strategy/strategy-brand-deals";
import { StrategyOutletList } from "@/components/strategy/strategy-outlet-list";
import { StrategyWorkflowTable } from "@/components/strategy/strategy-workflow-table";
import { StrategyEventsList } from "@/components/strategy/strategy-events-list";
import Link from "next/link";

type Props = { params: { clientId: string } };

export const metadata = { title: "Strategy" };
export const dynamic = "force-dynamic";

export default async function StrategyPage({ params }: Props) {
  await requireUser();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, name: true },
  });
  if (!client) notFound();

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
  const bigWins = items.filter((i) => i.isBigWin);
  const brandDeals = items.filter((i) => i.category === "BRAND_OPPORTUNITY");
  const mediaTargets = items.filter(
    (i) => i.category === "MEDIA_TARGET" && !i.isBigWin
  );
  const influencers = items.filter((i) => i.category === "INFLUENCER");
  const events = items.filter((i) => i.category === "EVENT");
  const positioning = items.filter((i) => i.category === "POSITIONING");
  const other = items.filter((i) => i.category === "OTHER");

  // Group brand deals by brandCategory
  const brandDealsByCategory = new Map<string, typeof brandDeals>();
  for (const item of brandDeals) {
    const cat = item.brandCategory ?? "Other";
    const arr = brandDealsByCategory.get(cat) ?? [];
    arr.push(item);
    brandDealsByCategory.set(cat, arr);
  }

  const totalItems = items.length;

  return (
    <>
      <PageHeader
        title="Strategy"
        subtitle={`${client.name} · ${totalItems} items`}
        actions={
          <div className="flex gap-2">
            <Link
              href={`/clients/${client.id}/strategy/brief`}
              className="inline-flex h-9 items-center rounded-md border border-border bg-white px-4 text-sm font-medium text-ink-secondary hover:border-border-strong transition-colors"
            >
              View Brief
            </Link>
            <button className="inline-flex h-9 items-center rounded-md bg-ink-primary px-4 text-sm font-medium text-ink-inverted hover:bg-ink-primary/90 transition-colors">
              + Add Item
            </button>
          </div>
        }
      />

      <div className="space-y-8">
        {/* Strategy document brief */}
        {doc ? (
          <StrategyDocumentCard doc={doc} clientId={client.id} />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-ink-secondary font-medium">
              No strategy brief yet
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Add the client objective, messaging, and phase structure.
            </p>
            <button className="mt-3 inline-flex h-8 items-center rounded-md bg-ink-primary px-3 text-xs font-medium text-ink-inverted hover:bg-ink-primary/90 transition-colors">
              Create Strategy Brief
            </button>
          </div>
        )}

        {/* Phase banners */}
        {doc && (doc.phase1Name || doc.phase2Name) && (
          <StrategyPhaseBanner doc={doc} />
        )}

        {/* Big Wins */}
        {bigWins.length > 0 && (
          <StrategyBigWins items={bigWins} />
        )}

        {/* Brand Deals */}
        {brandDeals.length > 0 && (
          <StrategyBrandDeals byCategory={brandDealsByCategory} />
        )}

        {/* Media Targets */}
        {mediaTargets.length > 0 && (
          <StrategyOutletList
            title="Press & Media Targets"
            items={mediaTargets}
            category="MEDIA_TARGET"
          />
        )}

        {/* Influencers */}
        {influencers.length > 0 && (
          <StrategyOutletList
            title="Influencer Targets"
            items={influencers}
            category="INFLUENCER"
          />
        )}

        {/* Events */}
        {events.length > 0 && (
          <StrategyEventsList items={events} />
        )}

        {/* Positioning */}
        {positioning.length > 0 && (
          <StrategyOutletList
            title="Positioning Angles"
            items={positioning}
            category="POSITIONING"
          />
        )}

        {/* Workflow table */}
        {tasks.length > 0 && (
          <StrategyWorkflowTable tasks={tasks} />
        )}

        {/* Empty state */}
        {totalItems === 0 && !doc && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
            <p className="text-sm font-medium text-ink-primary">
              Strategy wishlist is empty
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Build the preparation month wishlist — media targets, influencers, events, brand deals.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
