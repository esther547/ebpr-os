import { requireUser } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader, SectionHeader } from "@/components/layout/header";
import { monthLabel, DELIVERABLE_TYPE_LABELS } from "@/lib/utils";
import { currentMonthYearInTz } from "@/components/runners/miami-time";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, Th, Td, TableEmpty } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Download, Users, CheckCircle2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

/** Matches buttonVariants({ variant: "secondary", size: "xs" }). */
const EXPORT_LINK_CLASS =
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-white px-2.5 py-0 text-xs font-medium text-ink-primary shadow-sm transition-all duration-150 hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/25 focus-visible:ring-offset-2 h-7";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

function parseMonthYear(searchParams: { month?: string; year?: string }) {
  const current = currentMonthYearInTz();
  const month = Number(searchParams.month ?? current.month);
  const year = Number(searchParams.year ?? current.year);
  const valid =
    Number.isInteger(month) && month >= 1 && month <= 12 &&
    Number.isInteger(year) && year >= 2000 && year <= 2100;
  return valid ? { month, year } : current;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const user = await requireUser();
  if (!canViewReports(user)) {
    return (
      <div className="py-16">
        <EmptyState title="Access restricted" description="You do not have permission to view reports." />
      </div>
    );
  }

  const { month, year } = parseMonthYear(searchParams ?? {});
  const prev = month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
  const next = month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };

  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, monthlyTarget: true },
    orderBy: { name: "asc" },
  });

  // One query for all clients (instead of one per client): status + type counts
  const grouped = await db.deliverable.groupBy({
    by: ["clientId", "status", "type"],
    where: { month, year, clientId: { in: clients.map((c) => c.id) } },
    _count: { _all: true },
  });

  const perClient = new Map<
    string,
    { completed: number; inProgress: number; total: number; media: Record<string, number> }
  >();
  for (const g of grouped) {
    const cur = perClient.get(g.clientId) ?? { completed: 0, inProgress: 0, total: 0, media: {} };
    const n = g._count._all;
    if (g.status !== "CANCELLED") cur.total += n;
    if (g.status === "COMPLETED") {
      cur.completed += n;
      cur.media[g.type] = (cur.media[g.type] ?? 0) + n;
    } else if (g.status !== "CANCELLED") {
      cur.inProgress += n;
    }
    perClient.set(g.clientId, cur);
  }

  const deliverableStats = clients.map((client) => ({
    ...client,
    ...(perClient.get(client.id) ?? { completed: 0, inProgress: 0, total: 0, media: {} }),
  }));

  const totalCompleted = deliverableStats.reduce((s, c) => s + c.completed, 0);
  const totalTarget = deliverableStats.reduce((s, c) => s + c.monthlyTarget, 0);

  const monthHref = (m: { month: number; year: number }) => `/reports?month=${m.month}&year=${m.year}`;
  const overallRate = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Agency overview"
        title="Reports"
        subtitle={`Client pacing for ${monthLabel(month, year)}`}
        actions={
          <>
          <Link
            href="/reports/strategists"
            className="inline-flex h-9 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-white px-3 text-xs font-medium text-ink-primary shadow-sm transition-all duration-150 hover:border-border-strong hover:bg-surface-2"
          >
            Por estratega →
          </Link>
          {/* Month navigation — segmented control */}
          <div className="inline-flex items-center overflow-hidden rounded-lg border border-border bg-white shadow-sm">
            <Link
              href={monthHref(prev)}
              aria-label={`Previous month: ${monthLabel(prev.month, prev.year)}`}
              className="inline-flex h-9 items-center gap-1 px-3 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink-primary"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{monthLabel(prev.month, prev.year)}</span>
            </Link>
            <span className="h-9 border-x border-border bg-surface-2 px-4 text-xs font-semibold leading-9 text-ink-primary">
              {monthLabel(month, year)}
            </span>
            <Link
              href={monthHref(next)}
              aria-label={`Next month: ${monthLabel(next.month, next.year)}`}
              className="inline-flex h-9 items-center gap-1 px-3 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink-primary"
            >
              <span className="hidden sm:inline">{monthLabel(next.month, next.year)}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          </>
        }
      />

      <div className="space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Active Clients" value={clients.length} icon={<Users />} />
          <StatTile
            label="Deliverables Completed"
            value={`${totalCompleted}/${totalTarget}`}
            hint={monthLabel(month, year)}
            icon={<CheckCircle2 />}
          />
          <StatTile
            label="Overall Completion Rate"
            value={`${overallRate}%`}
            hint={overallRate >= 100 ? "Target met" : `${100 - overallRate}% to target`}
            tone={overallRate >= 80 ? "success" : overallRate < 50 ? "warning" : "neutral"}
            icon={<TrendingUp />}
          />
        </div>

        {/* Per-client table */}
        <section>
          <SectionHeader title={`Client pacing — ${monthLabel(month, year)}`} />
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-auto">
              <Table className="min-w-[900px]">
                <thead>
                  <tr>
                    <Th>Client</Th>
                    <Th align="right">Target</Th>
                    <Th align="right">Completed</Th>
                    <Th align="right">In Progress</Th>
                    <Th>Media</Th>
                    <Th>Rate</Th>
                    <Th>Status</Th>
                    <Th align="right">Report</Th>
                  </tr>
                </thead>
                <tbody>
                  {deliverableStats.map((client) => {
                    const rate =
                      client.monthlyTarget > 0
                        ? Math.round((client.completed / client.monthlyTarget) * 100)
                        : 0;
                    const isPrep = client.monthlyTarget <= 0;
                    const isOnTarget = !isPrep && client.completed >= client.monthlyTarget;
                    const isOnTrack = !isPrep && rate >= 60;
                    const media = Object.entries(client.media);

                    return (
                      <tr key={client.id}>
                        <Td className="font-medium">
                          <Link href={`/clients/${client.id}`} className="hover:underline">
                            {client.name}
                          </Link>
                        </Td>
                        <Td align="right" numeric className="text-ink-secondary">
                          {client.monthlyTarget}
                        </Td>
                        <Td align="right" numeric className="font-semibold">
                          {client.completed}
                        </Td>
                        <Td align="right" numeric className="text-ink-secondary">
                          {client.inProgress}
                        </Td>
                        <Td>
                          {media.length === 0 ? (
                            <span className="text-xs text-ink-muted">&mdash;</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {media.map(([type, count]) => (
                                <Badge key={type} size="xs">
                                  {DELIVERABLE_TYPE_LABELS[type as keyof typeof DELIVERABLE_TYPE_LABELS] ?? type}: {count}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
                              <div
                                className="h-full rounded-full bg-ink-primary transition-all"
                                style={{ width: `${Math.min(rate, 100)}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-xs tabular text-ink-secondary">{rate}%</span>
                          </div>
                        </Td>
                        <Td>
                          <Badge tone={isPrep ? "neutral" : isOnTarget ? "success" : isOnTrack ? "warning" : "danger"} dot>
                            {isPrep ? "Prep month" : isOnTarget ? "On Target" : isOnTrack ? "On Track" : "Behind"}
                          </Badge>
                        </Td>
                        <Td align="right">
                          {/* Styled as a secondary xs Button; <Button asChild> is
                              currently broken app-wide (Slot receives >1 child). */}
                          <a
                            href={`/api/reports/${client.id}/export?month=${month}&year=${year}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={EXPORT_LINK_CLASS}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Export
                          </a>
                        </Td>
                      </tr>
                    );
                  })}
                  {deliverableStats.length === 0 && (
                    <TableEmpty colSpan={8}>No active clients.</TableEmpty>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </section>
      </div>
    </>
  );
}
