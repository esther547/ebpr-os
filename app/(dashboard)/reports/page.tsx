import { requireUser } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { currentMonthYear, monthLabel, cn } from "@/lib/utils";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireUser();
  if (!canViewReports(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const { month, year } = currentMonthYear();

  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, monthlyTarget: true },
    orderBy: { name: "asc" },
  });

  // Pull deliverable counts per client for current month
  const deliverableStats = await Promise.all(
    clients.map(async (client) => {
      const deliverables = await db.deliverable.findMany({
        where: { clientId: client.id, month, year },
        select: { status: true },
      });
      const completed = deliverables.filter((d) => d.status === "COMPLETED").length;
      const inProgress = deliverables.filter(
        (d) => !["COMPLETED", "CANCELLED"].includes(d.status)
      ).length;
      return { ...client, completed, inProgress, total: deliverables.length };
    })
  );

  const totalCompleted = deliverableStats.reduce((s, c) => s + c.completed, 0);
  const totalTarget = deliverableStats.reduce((s, c) => s + c.monthlyTarget, 0);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`${monthLabel(month, year)} · Agency Overview`}
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
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Rate</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
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

                return (
                  <tr key={client.id} className="hover:bg-surface-1 transition-colors">
                    <td className="px-5 py-4 font-medium text-ink-primary">
                      {client.name}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
