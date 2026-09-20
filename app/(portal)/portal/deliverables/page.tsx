import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliverableStatus } from "@prisma/client";
import { monthLabel, formatDate, DELIVERABLE_TYPE_LABELS } from "@/lib/utils";
import { ClipboardList } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Deliverables" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<DeliverableStatus, string> = {
  IDEA: "Planned",
  OUTREACH: "Outreach",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default async function PortalDeliverablesPage() {
  const clientUser = await getCurrentClientUser();
  if (!clientUser) redirect("/sign-in");
  if (!clientUser.isActive) redirect("/access-pending");

  // Client-facing only: never internal deliverables, never internal notes
  const deliverables = await db.deliverable.findMany({
    where: {
      clientId: clientUser.clientId,
      isClientVisible: true,
      isInternal: false,
      status: { not: "CANCELLED" },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      outcome: true,
      dueDate: true,
      completedAt: true,
      month: true,
      year: true,
    },
  });

  // Group by month
  const groups = new Map<string, { month: number; year: number; items: typeof deliverables }>();
  for (const d of deliverables) {
    const key = `${d.year}-${d.month}`;
    const g = groups.get(key) ?? { month: d.month, year: d.year, items: [] };
    g.items.push(d);
    groups.set(key, g);
  }

  const completedCount = deliverables.filter((d) => d.status === "COMPLETED").length;
  const activeCount = deliverables.length - completedCount;

  return (
    <div className="space-y-6">
      <PageHeader
        className="pt-0 pb-0 sm:pt-0"
        title="Deliverables"
        subtitle={
          deliverables.length === 0
            ? "Your campaign deliverables will appear here."
            : `${completedCount} completed · ${activeCount} in motion`
        }
      />

      {deliverables.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="Nothing to show yet"
          description="Deliverables your EBPR team shares with you will be listed here, grouped by month."
        />
      ) : (
        <div className="space-y-6">
          {Array.from(groups.values()).map((g) => (
            <section key={`${g.year}-${g.month}`}>
              <SectionHeader title={monthLabel(g.month, g.year)} />
              <Card padding="none" className="divide-y divide-border">
                {g.items.map((d) => (
                  <div key={d.id} className="flex items-start justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="eyebrow mb-0.5">{DELIVERABLE_TYPE_LABELS[d.type]}</p>
                      <p className="text-sm font-medium text-ink-primary">{d.title}</p>
                      {d.status === "COMPLETED" && d.outcome && (
                        <p className="mt-1 max-w-prose text-sm text-ink-secondary">{d.outcome}</p>
                      )}
                      <p className="mt-1 text-2xs text-ink-muted">
                        {d.status === "COMPLETED" && d.completedAt
                          ? `Completed ${formatDate(d.completedAt)}`
                          : d.dueDate
                            ? `Target ${formatDate(d.dueDate)}`
                            : ""}
                      </p>
                    </div>
                    <Badge tone={statusTone(d.status)} dot className="shrink-0">
                      {STATUS_LABELS[d.status]}
                    </Badge>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
