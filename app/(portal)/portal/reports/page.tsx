import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentMonthYear, monthLabel, DELIVERABLE_TYPE_LABELS, cn } from "@/lib/utils";
import { DeliverableStatus } from "@prisma/client";
import { Trophy, Target, TrendingUp } from "lucide-react";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function PortalReportsPage() {
  const clientUser = await getCurrentClientUser();
  if (!clientUser) redirect("/sign-in");

  const { month, year } = currentMonthYear();

  const client = await db.client.findUnique({
    where: { id: clientUser.clientId },
    select: { id: true, name: true, monthlyTarget: true },
  });
  if (!client) redirect("/sign-in");

  const deliverables = await db.deliverable.findMany({
    where: {
      clientId: clientUser.clientId,
      isClientVisible: true,
      month,
      year,
    },
    orderBy: { completedAt: "desc" },
  });

  const completed = deliverables.filter((d) => d.status === DeliverableStatus.COMPLETED);
  const inProgress = deliverables.filter((d) =>
    ["OUTREACH", "CONFIRMED", "IN_PROGRESS"].includes(d.status)
  );

  const completionRate = client.monthlyTarget > 0
    ? Math.round((completed.length / client.monthlyTarget) * 100)
    : 0;

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-primary mb-1">Monthly Report</h1>
      <p className="text-sm text-ink-muted mb-6">{monthLabel(month, year)}</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
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

      {/* Wins */}
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
                    {DELIVERABLE_TYPE_LABELS[d.type]}
                  </span>
                </div>
                <p className="text-sm font-medium text-ink-primary">{d.title}</p>
                {d.outcome && (
                  <p className="mt-1 text-sm text-ink-secondary">{d.outcome}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* In Progress */}
      {inProgress.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            In Progress ({inProgress.length})
          </h2>
          <div className="space-y-2">
            {inProgress.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3">
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-medium text-blue-700">
                  {d.status.replace("_", " ")}
                </span>
                <span className="text-sm text-ink-primary">{d.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {deliverables.length === 0 && (
        <div className="text-center py-20">
          <p className="text-sm text-ink-muted">No deliverables this month yet.</p>
        </div>
      )}
    </div>
  );
}
