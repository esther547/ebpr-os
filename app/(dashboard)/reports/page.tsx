import { requireUser } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { monthLabel, cn, DELIVERABLE_TYPE_LABELS } from "@/lib/utils";
import { currentMonthYearInTz } from "@/components/runners/miami-time";
import Link from "next/link";

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
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
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

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`${monthLabel(month, year)} · Agency Overview`}
        actions={
          <div className="flex items-center gap-1 text-xs">
            <Link href={monthHref(prev)} className="rounded-md border border-border px-2.5 py-1.5 text-ink-secondary hover:bg-surface-2">
              ← {monthLabel(prev.month, prev.year)}
            </Link>
            <Link href={monthHref(next)} className="rounded-md border border-border px-2.5 py-1.5 text-ink-secondary hover:bg-surface-2">
              {monthLabel(next.month, next.year)} →
            </Link>
          </div>
        }
      />

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-3 gap-6">
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Active Clients
          </p>
          <p className="mt-2 text-4xl font-bold text-ink-primary">
            {clients.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Deliverables Completed
          </p>
          <p className="mt-2 text-4xl font-bold text-ink-primary">
            {totalCompleted}
            <span className="text-lg font-medium text-ink-muted ml-1">
              / {totalTarget}
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Overall Completion Rate
          </p>
          <p className="mt-2 text-4xl font-bold text-ink-primary">
            {totalTarget > 0
              ? Math.round((totalCompleted / totalTarget) * 100)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Per-client table */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Client Pacing — {monthLabel(month, year)}
        </h2>
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-1">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Client</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Target</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Completed</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">In Progress</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Media</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Rate</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deliverableStats.map((client) => {
                const rate =
                  client.monthlyTarget > 0
                    ? Math.round((client.completed / client.monthlyTarget) * 100)
                    : 0;
                const isOnTarget = client.completed >= client.monthlyTarget;
                const isOnTrack = rate >= 60;
                const media = Object.entries(client.media);

                return (
                  <tr key={client.id} className="hover:bg-surface-1 transition-colors">
                    <td className="px-5 py-4 font-medium text-ink-primary">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-ink-secondary">
                      {client.monthlyTarget}
                    </td>
                    <td className="px-5 py-4 font-semibold text-ink-primary">
                      {client.completed}
                    </td>
                    <td className="px-5 py-4 text-ink-secondary">
                      {client.inProgress}
                    </td>
                    <td className="px-5 py-4">
                      {media.length === 0 ? (
                        <span className="text-xs text-ink-muted">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {media.map(([type, count]) => (
                            <span key={type} className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-ink-secondary">
                              {DELIVERABLE_TYPE_LABELS[type as keyof typeof DELIVERABLE_TYPE_LABELS] ?? type}: {count}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className="h-full bg-ink-primary rounded-full transition-all"
                            style={{ width: `${Math.min(rate, 100)}%` }}
                          />
                        </div>
                        <span className="text-ink-secondary">{rate}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          isOnTarget
                            ? "bg-green-50 text-green-700"
                            : isOnTrack
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-600"
                        )}
                      >
                        {isOnTarget ? "On Target" : isOnTrack ? "On Track" : "Behind"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <a
                        href={`/api/reports/${client.id}/export?month=${month}&year=${year}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-ink-secondary hover:text-ink-primary hover:underline"
                      >
                        Export
                      </a>
                    </td>
                  </tr>
                );
              })}
              {deliverableStats.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-ink-muted">
                    No active clients.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
