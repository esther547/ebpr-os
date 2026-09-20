import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";
import { monthLabel, DELIVERABLE_TYPE_LABELS, DELIVERABLE_STATUS_LABELS } from "@/lib/utils";
import { Trophy, Target, TrendingUp, Calendar, MapPin } from "lucide-react";
import { currentMonthYearInTz, formatInTz } from "@/components/runners/miami-time";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";

export const dynamic = "force-dynamic";

// Next 14: route params are a plain object (not a Promise)
type Params = { params: { token: string } };

export async function generateMetadata({ params }: Params) {
  const { token } = params;
  if (!token) return { title: "Campaign Monitor" };
  const client = await db.client.findUnique({ where: { shareToken: token }, select: { name: true } });
  return { title: client ? `${client.name} — Campaign Monitor` : "Campaign Monitor" };
}

export default async function CampaignMonitorPage({ params }: Params) {
  const { token } = params;
  if (!token) return notFound();

  const client = await db.client.findUnique({
    where: { shareToken: token },
    select: { id: true, name: true, logo: true, monthlyTarget: true },
  });

  if (!client) return notFound();

  const { month, year } = currentMonthYearInTz();

  // Public page: only client-visible, non-internal deliverables, and only the
  // fields that are shown (never notes or anything financial).
  const deliverables = await db.deliverable.findMany({
    where: {
      clientId: client.id,
      isClientVisible: true,
      isInternal: false,
      status: { not: "CANCELLED" },
      month,
      year,
    },
    select: { id: true, title: true, type: true, status: true, outcome: true, completedAt: true },
    orderBy: [{ completedAt: "desc" }, { createdAt: "asc" }],
  });

  const completed = deliverables.filter((d) => d.status === "COMPLETED");
  const inProgress = deliverables.filter((d) => ["OUTREACH", "CONFIRMED", "IN_PROGRESS"].includes(d.status));
  const completionRate = client.monthlyTarget > 0
    ? Math.round((completed.length / client.monthlyTarget) * 100)
    : 0;

  // Type breakdown
  const typeBreakdown = completed.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get upcoming agenda
  const agenda = await db.runnerAssignment.findMany({
    where: {
      clientId: client.id,
      eventDate: { gte: new Date() },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    orderBy: { eventDate: "asc" },
    take: 10,
    // Display fields only — no runner identity or internal logistics notes
    select: { id: true, eventName: true, eventDate: true, eventTime: true, venueName: true, location: true, status: true },
  });

  return (
    <div className="min-h-screen bg-surface-1">
      {/* Brand header */}
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow mb-1.5">Campaign Monitor</p>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-ink-primary sm:text-3xl">
                {client.name}
              </h1>
              <p className="mt-1 text-sm text-ink-secondary">{monthLabel(month, year)}</p>
            </div>
            <div className="shrink-0 pt-1">
              <EBPRLogoHorizontal size="sm" />
            </div>
          </div>
        </div>
      </header>

      <main className="page-enter mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {/* Month progress */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="Wins Delivered"
              value={completed.length}
              icon={<Trophy />}
              tone={completionRate >= 100 ? "success" : "neutral"}
            />
            <StatTile label="Monthly Target" value={client.monthlyTarget} icon={<Target />} />
            <StatTile label="Completion Rate" value={`${completionRate}%`} icon={<TrendingUp />} />
          </div>

          <Card>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="eyebrow">{monthLabel(month, year)} progress</p>
              <p className="text-sm font-semibold tabular text-ink-primary">
                {completed.length} / {client.monthlyTarget}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-ink-primary transition-all duration-500"
                style={{ width: `${Math.min(completionRate, 100)}%` }}
              />
            </div>
          </Card>
        </section>

        {/* Media breakdown */}
        {Object.keys(typeBreakdown).length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">Media Breakdown</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(typeBreakdown).map(([type, count]) => (
                <Badge key={type} tone="outline" size="md">
                  {DELIVERABLE_TYPE_LABELS[type as keyof typeof DELIVERABLE_TYPE_LABELS] || type}: {count}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Completed wins */}
        {completed.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">Completed Wins</h2>
            <div className="space-y-3">
              {completed.map((d) => (
                <Card key={d.id} padding="sm">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone="success" dot>
                      {DELIVERABLE_TYPE_LABELS[d.type as keyof typeof DELIVERABLE_TYPE_LABELS] || d.type}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-ink-primary">{d.title}</p>
                  {d.outcome && <p className="mt-1 text-sm text-ink-secondary">{d.outcome}</p>}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* In progress */}
        {inProgress.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">In Progress ({inProgress.length})</h2>
            <div className="space-y-2">
              {inProgress.map((d) => (
                <Card key={d.id} padding="sm">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <Badge tone={statusTone(d.status)} dot className="self-start">
                      {DELIVERABLE_STATUS_LABELS[d.status as keyof typeof DELIVERABLE_STATUS_LABELS] || d.status}
                    </Badge>
                    <span className="text-sm text-ink-primary">{d.title}</span>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming agenda */}
        {agenda.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">Upcoming Agenda</h2>
            <div className="space-y-3">
              {agenda.map((a) => (
                <Card key={a.id} padding="sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-primary">{a.eventName}</p>
                      <div className="mt-1 flex flex-col gap-1 text-xs text-ink-secondary sm:flex-row sm:flex-wrap sm:gap-x-4">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                          {formatInTz(a.eventTime ?? a.eventDate, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        {(a.venueName || a.location) && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                            {a.venueName || a.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge tone={statusTone(a.status)} className="self-start" dot>
                      {a.status === "CONFIRMED" ? "Confirmed" : "Scheduled"}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {deliverables.length === 0 && agenda.length === 0 && (
          <Card className="py-16 text-center">
            <p className="text-sm font-semibold text-ink-primary">No activity yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              This month&apos;s campaign activity will appear here.
            </p>
          </Card>
        )}

        {/* What deliverables mean */}
        <section>
          <h2 className="eyebrow mb-3">What Each Deliverable Means</h2>
          <Card>
            <dl className="space-y-3 text-sm">
              {[
                ["Press Placement", "Your story featured in a media outlet (magazine, newspaper, online publication)"],
                ["Interview", "A TV, radio, podcast, or print interview secured and completed"],
                ["Event Appearance", "Red carpet, premiere, brand event, or public appearance coordinated"],
                ["Influencer Collab", "Partnership with an influencer for cross-promotion or content"],
                ["Brand Opportunity", "Sponsorship, endorsement deal, or brand partnership secured"],
                ["Introduction", "Key industry connection or meeting facilitated on your behalf"],
                ["Social Media", "Strategic social media content or campaign executed"],
                ["Press Release", "Official press release drafted, approved, and distributed to media"],
              ].map(([term, definition]) => (
                <div key={term} className="sm:flex sm:gap-3">
                  <dt className="font-medium text-ink-primary sm:w-44 sm:shrink-0">{term}</dt>
                  <dd className="text-ink-muted">{definition}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-8 text-center">
          <div className="flex justify-center">
            <EBPRLogoHorizontal size="sm" />
          </div>
          <p className="mt-3 text-xs text-ink-muted">Prepared by EB Public Relations</p>
        </footer>
      </main>
    </div>
  );
}
