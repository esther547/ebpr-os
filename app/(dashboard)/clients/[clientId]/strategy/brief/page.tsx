import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, cn } from "@/lib/utils";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";

type Props = { params: { clientId: string } };

export async function generateMetadata({ params }: Props) {
  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { name: true },
  });
  return { title: client ? `${client.name} — Strategy Brief` : "Strategy Brief" };
}

export default async function StrategyBriefPage({ params }: Props) {
  await requireUser();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, name: true, industry: true },
  });
  if (!client) notFound();

  const doc = await db.strategyDocument.findUnique({
    where: { clientId: params.clientId },
  });

  const items = await db.strategyItem.findMany({
    where: { clientId: params.clientId },
    orderBy: [{ phase: "asc" }, { priority: "desc" }, { scheduledDate: "asc" }],
  });

  const keyMessages = doc?.keyMessages as string[] | null;
  const externalCollabs = doc?.externalCollaborators as
    | { name: string; role: string; organization?: string }[]
    | null;

  // Categorize
  const bigWins = items.filter((i) => i.isBigWin);
  const brandDeals = items.filter((i) => i.category === "BRAND_OPPORTUNITY");
  const mediaTargets = items.filter((i) => i.category === "MEDIA_TARGET" && !i.isBigWin);
  const influencers = items.filter((i) => i.category === "INFLUENCER");
  const events = items.filter((i) => i.category === "EVENT");
  const positioning = items.filter((i) => i.category === "POSITIONING");

  // Brand deals grouped
  const brandDealsByCategory = new Map<string, typeof brandDeals>();
  for (const item of brandDeals) {
    const cat = item.brandCategory ?? "Other";
    const arr = brandDealsByCategory.get(cat) ?? [];
    arr.push(item);
    brandDealsByCategory.set(cat, arr);
  }

  const hasPhases = doc?.phase1Name || doc?.phase2Name;

  return (
    <div className="min-h-screen bg-white">
      {/* Print controls — hidden in print */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/95 backdrop-blur px-8 py-3">
        <a
          href={`/clients/${client.id}/strategy`}
          className="text-xs text-ink-muted hover:text-ink-primary transition-colors"
        >
          ← Back to Strategy
        </a>
        <button
          onClick={() => window.print()}
          className="inline-flex h-8 items-center rounded-md bg-ink-primary px-4 text-xs font-medium text-ink-inverted hover:bg-ink-primary/90 transition-colors"
        >
          Print / Export PDF
        </button>
      </div>

      {/* Brief content */}
      <div className="mx-auto max-w-4xl px-8 py-10 space-y-10">
        {/* Page header */}
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div>
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-1">
              Confidential · EB Public Relations
            </p>
            <h1 className="text-3xl font-bold text-ink-primary">{client.name}</h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Strategy Brief
              {doc?.year ? ` · ${doc.year}` : ""}
              {doc?.location ? ` · ${doc.location}` : ""}
            </p>
          </div>
          <EBPRLogoHorizontal className="h-8 opacity-70" />
        </div>

        {/* Prep + Campaign dates */}
        {doc && (doc.prepMonthStart || doc.campaignStart) && (
          <div className="flex items-center gap-8 rounded-lg border border-border bg-surface-1 px-6 py-4">
            {doc.prepMonthStart && doc.prepMonthEnd && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted">
                  Prep Month
                </p>
                <p className="text-sm font-medium text-ink-primary mt-0.5">
                  {formatDate(doc.prepMonthStart)} – {formatDate(doc.prepMonthEnd)}
                </p>
              </div>
            )}
            {doc.campaignStart && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted">
                  Campaign Start
                </p>
                <p className="text-sm font-medium text-ink-primary mt-0.5">
                  {formatDate(doc.campaignStart)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phases */}
        {hasPhases && (
          <div className="grid grid-cols-2 gap-4">
            {doc?.phase1Name && (
              <div className="rounded-lg border border-border px-5 py-4">
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-1">
                  Phase 1
                </p>
                <p className="font-bold text-ink-primary">{doc.phase1Name}</p>
                {(doc.phase1Start || doc.phase1End) && (
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatDate(doc.phase1Start)} – {formatDate(doc.phase1End)}
                  </p>
                )}
              </div>
            )}
            {doc?.phase2Name && (
              <div className="rounded-lg border border-border px-5 py-4">
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-1">
                  Phase 2
                </p>
                <p className="font-bold text-ink-primary">{doc.phase2Name}</p>
                {(doc.phase2Start || doc.phase2End) && (
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatDate(doc.phase2Start)} – {formatDate(doc.phase2End)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Narrative — Objective + Path */}
        {doc && (doc.objective || doc.strategicPath) && (
          <div className="grid grid-cols-2 gap-8">
            {doc.objective && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-2">
                  Objetivo
                </p>
                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                  {doc.objective}
                </p>
              </div>
            )}
            {doc.strategicPath && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-2">
                  Camino Estratégico
                </p>
                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                  {doc.strategicPath}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Messaging + Persona */}
        {doc && (doc.messagingFramework || doc.clientPersona) && (
          <div className="grid grid-cols-2 gap-8 border-t border-border pt-8">
            {doc.messagingFramework && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-2">
                  Messaging
                </p>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  {doc.messagingFramework}
                </p>
              </div>
            )}
            {doc.clientPersona && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-2">
                  Personaje
                </p>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  {doc.clientPersona}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Key Messages */}
        {keyMessages && keyMessages.length > 0 && (
          <div className="border-t border-border pt-8">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-3">
              Key Messages
            </p>
            <div className="space-y-2">
              {keyMessages.map((msg, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-primary" />
                  <p className="text-sm font-semibold text-ink-primary italic">"{msg}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Target Audience */}
        {doc?.targetAudience && (
          <div className="border-t border-border pt-8">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-2">
              Fanbase / Target Audience
            </p>
            <p className="text-sm text-ink-secondary">{doc.targetAudience}</p>
          </div>
        )}

        {/* Big Wins */}
        {bigWins.length > 0 && (
          <div className="border-t border-border pt-8">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-3">
              ★ Big Wins
            </p>
            <div className="space-y-1.5">
              {bigWins.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="text-xs text-ink-muted">★</span>
                  <span className="text-sm font-medium text-ink-primary">
                    {item.targetName ?? item.title}
                  </span>
                  {item.notes && (
                    <span className="text-xs text-ink-muted">· {item.notes}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Brand Deals */}
        {brandDeals.length > 0 && (
          <div className="border-t border-border pt-8">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-4">
              Brand Deals
            </p>
            <div className="space-y-4">
              {Array.from(brandDealsByCategory.entries()).map(([cat, catItems]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-ink-primary mb-1.5">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {catItems.map((item) => (
                      <span
                        key={item.id}
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink-secondary"
                      >
                        {item.targetName ?? item.title}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Media Targets */}
        {mediaTargets.length > 0 && (
          <BriefItemList title="Press & Media Targets" items={mediaTargets} />
        )}

        {/* Influencers */}
        {influencers.length > 0 && (
          <BriefItemList title="Influencer Targets" items={influencers} />
        )}

        {/* Events */}
        {events.length > 0 && (
          <div className="border-t border-border pt-8">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-3">
              Events
            </p>
            <div className="space-y-2">
              {events.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  {item.scheduledDate ? (
                    <span className="flex-shrink-0 w-20 text-right text-xs font-semibold text-ink-primary">
                      {new Date(item.scheduledDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  ) : (
                    <span className="flex-shrink-0 w-20 text-right text-xs text-ink-muted">TBC</span>
                  )}
                  <span className="text-sm text-ink-primary">
                    {item.targetName ?? item.title}
                  </span>
                  {item.eventLocation && (
                    <span className="text-xs text-ink-muted">{item.eventLocation}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Positioning */}
        {positioning.length > 0 && (
          <BriefItemList title="Positioning Angles" items={positioning} />
        )}

        {/* Execution Notes */}
        {doc?.executionNotes && (
          <div className="border-t border-border pt-8">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-2">
              Execution Notes
            </p>
            <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
              {doc.executionNotes}
            </p>
          </div>
        )}

        {/* External Team */}
        {externalCollabs && externalCollabs.length > 0 && (
          <div className="border-t border-border pt-8">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-3">
              External Team
            </p>
            <div className="flex flex-wrap gap-2">
              {externalCollabs.map((c, i) => (
                <span
                  key={i}
                  className="rounded-md border border-border px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-ink-primary">{c.name}</span>
                  {c.role && <span className="text-ink-muted"> · {c.role}</span>}
                  {c.organization && (
                    <span className="text-ink-muted"> ({c.organization})</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border pt-6 flex items-center justify-between">
          <p className="text-2xs text-ink-muted">
            EB Public Relations · Miami, FL · Confidential
          </p>
          <p className="text-2xs text-ink-muted">
            {new Date().toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @page { margin: 0.75in; }
        }
      `}</style>
    </div>
  );
}

function BriefItemList({
  title,
  items,
}: {
  title: string;
  items: { id: string; targetName: string | null; title: string; phase: number | null; scheduledDate: Date | null; episodeNumber: number | null }[];
}) {
  const phase1 = items.filter((i) => i.phase === 1);
  const phase2 = items.filter((i) => i.phase === 2);
  const noPhase = items.filter((i) => !i.phase);

  return (
    <div className="border-t border-border pt-8">
      <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-3">
        {title}{" "}
        <span className="font-normal text-ink-muted ml-1">({items.length})</span>
      </p>

      {phase1.length > 0 && (
        <div className="mb-3">
          <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted/60 mb-1.5">
            Phase 1
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {phase1.map((item) => (
              <span key={item.id} className="text-sm text-ink-secondary">
                {item.targetName ?? item.title}
                {item.episodeNumber && (
                  <span className="text-ink-muted"> Ep {item.episodeNumber}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {phase2.length > 0 && (
        <div className="mb-3">
          <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted/60 mb-1.5">
            Phase 2
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {phase2.map((item) => (
              <span key={item.id} className="text-sm text-ink-secondary">
                {item.targetName ?? item.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {noPhase.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {noPhase.map((item) => (
            <span key={item.id} className="text-sm text-ink-secondary">
              {item.targetName ?? item.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
