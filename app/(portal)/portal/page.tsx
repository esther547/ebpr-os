import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliverableStatus } from "@prisma/client";
import { currentMonthYear, monthLabel, DELIVERABLE_TYPE_LABELS } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/layout/header";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<DeliverableStatus, string> = {
  IDEA: "Planned",
  OUTREACH: "Outreach",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default async function PortalDashboardPage() {
  const clientUser = await getCurrentClientUser();
  if (!clientUser) redirect("/sign-in");
  if (!clientUser.isActive) redirect("/access-pending");

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
      isInternal: false,
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

  const onTarget = completed.length >= client.monthlyTarget;

  return (
    <div className="space-y-6">
      <PageHeader
        className="pt-0 pb-0 sm:pt-0"
        title={`Welcome back, ${clientUser.name.split(" ")[0]}`}
        subtitle={`${client.name} · ${monthLabel(month, year)}`}
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Completed This Month"
          value={completed.length}
          hint={`of ${client.monthlyTarget} target`}
          tone={onTarget ? "success" : "neutral"}
        />
        <StatTile
          label="In Progress"
          value={inProgress.length}
          hint="active deliverables"
        />
        <StatTile
          label="Awaiting Your Approval"
          value={pendingApprovals}
          hint={pendingApprovals > 0 ? "action required" : "all caught up"}
          tone={pendingApprovals > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* Wins section */}
      {completed.length > 0 && (
        <section>
          <SectionHeader title="Wins This Month" />
          <div className="space-y-3">
            {completed.map((d) => (
              <Card key={d.id} padding="md">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow mb-1">{DELIVERABLE_TYPE_LABELS[d.type]}</p>
                    <p className="font-medium text-ink-primary">{d.title}</p>
                    {d.outcome && (
                      <p className="mt-1 max-w-prose text-sm text-ink-secondary">{d.outcome}</p>
                    )}
                  </div>
                  <Badge tone="success" dot className="shrink-0 self-start">
                    Completed
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* In Progress */}
      {inProgress.length > 0 && (
        <section>
          <SectionHeader title="In Progress" />
          <Card padding="none" className="divide-y divide-border">
            {inProgress.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="eyebrow mb-0.5">{DELIVERABLE_TYPE_LABELS[d.type]}</p>
                  <p className="text-sm font-medium text-ink-primary">{d.title}</p>
                </div>
                <Badge tone={statusTone(d.status)} dot className="shrink-0">
                  {STATUS_LABELS[d.status]}
                </Badge>
              </div>
            ))}
          </Card>
        </section>
      )}

      {deliverables.length === 0 && (
        <EmptyState
          icon={<Sparkles />}
          title="Your campaign is being prepared"
          description="Wins and in-progress work for this month will appear here. Check back soon."
        />
      )}
    </div>
  );
}
