import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";
import { currentMonthYear, monthLabel, DELIVERABLE_TYPE_LABELS, DELIVERABLE_STATUS_LABELS, formatDate } from "@/lib/utils";
import { Trophy, Target, TrendingUp, Calendar, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await db.client.findUnique({ where: { shareToken: token }, select: { name: true } });
  return { title: client ? `${client.name} — Campaign Monitor` : "Campaign Monitor" };
}

export default async function CampaignMonitorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const client = await db.client.findUnique({
    where: { shareToken: token },
    select: { id: true, name: true, logo: true, monthlyTarget: true },
  });

  if (!client) return notFound();

  const { month, year } = currentMonthYear();

  // Get deliverables for current month
  const deliverables = await db.deliverable.findMany({
    where: {
      clientId: client.id,
      isClientVisible: true,
      month,
      year,
    },
    orderBy: { completedAt: "desc" },
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
      status: { not: "CANCELLED" },
    },
    orderBy: { eventDate: "asc" },
    take: 10,
    include: { runner: { select: { name: true } } },
  });

  return (
    <div className="min-h-screen bg-surface-1">
      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink-primary">{client.name}</h1>
              <p className="text-sm text-ink-muted mt-1">Campaign Monitor · {monthLabel(month, year)}</p>
            </div>
            <EBPRLogoHorizontal size="sm" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border border-border bg-white p-5 text-center">
            <Trophy className="mx-auto h-5 w-5 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-ink-primary">{completed.length}</p>
            <p className="text-xs text-ink-muted mt-1">Wins Delivered</p>
          </div>
          <div className="rounded-lg border border-border bg-white p-5 text-center">
            <Target className="mx-auto h-5 w-5 text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-ink-primary">{client.monthlyTarget}</p>
            <p className="text-xs text-ink-muted mt-1">Monthly Target</p>
          </div>
          <div className="rounded-lg border border-border bg-white p-5 text-center">
            <TrendingUp className="mx-auto h-5 w-5 text-amber-600 mb-2" />
            <p className="text-2xl font-bold text-ink-primary">{completionRate}%</p>
            <p className="text-xs text-ink-muted mt-1">Completion Rate</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
            <span>Progress</span>
            <span>{completed.length} / {client.monthlyTarget}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-ink-primary transition-all duration-500"
              style={{ width: `${Math.min(completionRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Media Breakdown */}
        {Object.keys(typeBreakdown).length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
              Media Breakdown
            </h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(typeBreakdown).map(([type, count]) => (
                <span key={type} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-secondary">
                  {DELIVERABLE_TYPE_LABELS[type as keyof typeof DELIVERABLE_TYPE_LABELS] || type}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* PR Deliverables Explained */}
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            What Each Deliverable Means
          </h2>
          <div className="rounded-lg border border-border bg-white p-5 space-y-3 text-sm">
            <div><span className="font-medium text-ink-primary">Press Placement</span> <span className="text-ink-muted">— Your story featured in a media outlet (magazine, newspaper, online publication)</span></div>
            <div><span className="font-medium text-ink-primary">Interview</span> <span className="text-ink-muted">— A TV, radio, podcast, or print interview secured and completed</span></div>
            <div><span className="font-medium text-ink-primary">Event Appearance</span> <span className="text-ink-muted">— Red carpet, premiere, brand event, or public appearance coordinated</span></div>
            <div><span className="font-medium text-ink-primary">Influencer Collab</span> <span className="text-ink-muted">— Partnership with an influencer for cross-promotion or content</span></div>
            <div><span className="font-medium text-ink-primary">Brand Opportunity</span> <span className="text-ink-muted">— Sponsorship, endorsement deal, or brand partnership secured</span></div>
            <div><span className="font-medium text-ink-primary">Introduction</span> <span className="text-ink-muted">— Key industry connection or meeting facilitated on your behalf</span></div>
            <div><span className="font-medium text-ink-primary">Social Media</span> <span className="text-ink-muted">— Strategic social media content or campaign executed</span></div>
            <div><span className="font-medium text-ink-primary">Press Release</span> <span className="text-ink-muted">— Official press release drafted, approved, and distributed to media</span></div>
          </div>
        </section>

        {/* Completed Wins */}
        {completed.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
              Completed Wins
            </h2>
            <div className="space-y-3">
              {completed.map((d) => (
                <div key={d.id} className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-2xs font-medium text-green-700">
                      {DELIVERABLE_TYPE_LABELS[d.type as keyof typeof DELIVERABLE_TYPE_LABELS] || d.type}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-ink-primary">{d.title}</p>
                  {d.outcome && <p className="mt-1 text-sm text-ink-secondary">{d.outcome}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* In Progress */}
        {inProgress.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
              In Progress ({inProgress.length})
            </h2>
            <div className="space-y-2">
              {inProgress.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-medium text-blue-700">
                    {DELIVERABLE_STATUS_LABELS[d.status as keyof typeof DELIVERABLE_STATUS_LABELS] || d.status}
                  </span>
                  <span className="text-sm text-ink-primary">{d.title}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Agenda */}
        {agenda.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
              Upcoming Agenda
            </h2>
            <div className="space-y-3">
              {agenda.map((a) => (
                <div key={a.id} className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink-primary">{a.eventName}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-ink-secondary">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(a.eventDate), "EEE, MMM d 'at' h:mm a")}
                        </span>
                        {a.venueName && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {a.venueName}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-medium text-blue-700 flex-shrink-0">
                      {a.status === "CONFIRMED" ? "Confirmed" : "Scheduled"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {deliverables.length === 0 && agenda.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm text-ink-muted">No activity this month yet.</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-8 border-t border-border mt-10">
          <EBPRLogoHorizontal size="sm" />
          <p className="text-xs text-ink-muted mt-2">EB Public Relations · Campaign Monitor</p>
        </div>
      </main>
    </div>
  );
}
