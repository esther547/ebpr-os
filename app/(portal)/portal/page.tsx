import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliverableStatus } from "@prisma/client";
import { currentMonthYear, monthLabel, DELIVERABLE_TYPE_LABELS, cn } from "@/lib/utils";
import { EBPRLogo } from "@/components/brand/ebpr-logo";

export const metadata = { title: "Dashboard" };

export default async function PortalDashboardPage() {
  const clientUser = await getCurrentClientUser();
  if (!clientUser) redirect("/sign-in");

  const { month, year } = currentMonthYear();

  const client = await db.client.findUnique({
    where: { id: clientUser.clientId },
    select: { id: true, name: true, monthlyTarget: true },
  });
  if (!client) redirect("/sign-in");

  // Only client-visible deliverables
  const deliverables = await db.deliverable.findMany({
    where: {
      clientId: clientUser.clientId,
      isClientVisible: true,
      month,
      year,
    },
    orderBy: { updatedAt: "desc" },
  });

  const completed = deliverables.filter(
    (d) => d.status === DeliverableStatus.COMPLETED
  );
  const inProgress = deliverables.filter(
    (d) =>
      d.status !== DeliverableStatus.COMPLETED &&
      d.status !== DeliverableStatus.CANCELLED
  );

  // Pending approvals
  const pendingApprovals = await db.approval.count({
    where: { clientId: clientUser.clientId, status: "PENDING" },
  });

  return (
    <div className="animate-fade-in">
      {/* Welcome */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-ink-primary">
          Welcome back, {clientUser.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-ink-secondary">
          {client.name} · {monthLabel(month, year)}
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-10 grid grid-cols-3 gap-6">
        <StatCard
          label="Completed This Month"
          value={String(completed.length)}
          sublabel={`of ${client.monthlyTarget} target`}
          highlight={completed.length >= client.monthlyTarget}
        />
        <StatCard
          label="In Progress"
          value={String(inProgress.length)}
          sublabel="active deliverables"
        />
        <StatCard
          label="Awaiting Your Approval"
          value={String(pendingApprovals)}
          sublabel={pendingApprovals > 0 ? "action required" : "all caught up"}
          urgent={pendingApprovals > 0}
        />
      </div>

      {/* Wins section */}
      {completed.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Wins This Month
          </h2>
          <div className="space-y-3">
            {completed.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-border bg-white px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
                      {DELIVERABLE_TYPE_LABELS[d.type]}
                    </p>
                    <p className="font-medium text-ink-primary">{d.title}</p>
                    {d.outcome && (
                      <p className="mt-1 text-sm text-ink-secondary">{d.outcome}</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Completed
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* In Progress */}
      {inProgress.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            In Progress
          </h2>
          <div className="space-y-2">
            {inProgress.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-border bg-white px-5 py-4"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-0.5">
                    {DELIVERABLE_TYPE_LABELS[d.type]}
                  </p>
                  <p className="font-medium text-sm text-ink-primary">{d.title}</p>
                </div>
                <DeliverableStatusBadge status={d.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {deliverables.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
          <EBPRLogo variant="mark" size="lg" className="mb-6 opacity-10" />
          <p className="text-sm text-ink-muted">
            Your campaign is being prepared. Check back soon.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  highlight,
  urgent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
  urgent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-6",
        highlight ? "border-green-200" : urgent ? "border-ink-primary" : "border-border"
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-4xl font-bold",
          highlight ? "text-green-700" : urgent ? "text-ink-primary" : "text-ink-primary"
        )}
      >
        {value}
      </p>
      {sublabel && (
        <p className="mt-1 text-sm text-ink-muted">{sublabel}</p>
      )}
    </div>
  );
}

function DeliverableStatusBadge({ status }: { status: DeliverableStatus }) {
  const styles: Record<DeliverableStatus, string> = {
    IDEA: "bg-surface-2 text-ink-secondary",
    OUTREACH: "bg-blue-50 text-blue-700",
    CONFIRMED: "bg-amber-50 text-amber-700",
    IN_PROGRESS: "bg-purple-50 text-purple-700",
    COMPLETED: "bg-green-50 text-green-700",
    CANCELLED: "bg-red-50 text-red-600",
  };
  const labels: Record<DeliverableStatus, string> = {
    IDEA: "Planned",
    OUTREACH: "Outreach",
    CONFIRMED: "Confirmed",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}
