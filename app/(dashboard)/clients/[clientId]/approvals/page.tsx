import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { CheckCircle } from "lucide-react";
import { ClientHeader } from "@/components/clients/client-header";
import { Card } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/layout/header";

type Props = { params: { clientId: string } };

export const metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

export default async function ClientApprovalsPage({ params }: Props) {
  await requireUser();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, name: true, status: true, monthlyTarget: true, industry: true, cycleDay: true, goalsOwed: true, focusNote: true, agendaDocUrl: true },
  });

  if (!client) notFound();

  const approvals = await db.approval.findMany({
    where: { clientId: params.clientId },
    orderBy: { createdAt: "desc" },
    include: {
      requestedBy: { select: { name: true } },
      deliverable: { select: { title: true } },
      responses: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { clientUser: { select: { name: true } } },
      },
    },
  });

  const pending = approvals.filter((a) => a.status === "PENDING");
  const resolved = approvals.filter((a) => a.status !== "PENDING");

  return (
    <>
      <ClientHeader client={client} counts={{ approvals: pending.length }} />

      {approvals.length === 0 ? (
        <EmptyState
          icon={<CheckCircle />}
          title="No approvals yet"
          description="Request approvals from the deliverables page."
        />
      ) : (
        <div className="space-y-8">
          <section>
            <SectionHeader title={`Pending approvals (${pending.length})`} />
            {pending.length > 0 ? (
              <div className="space-y-3">
                {pending.map((approval) => (
                  <ApprovalCard key={approval.id} approval={approval} />
                ))}
              </div>
            ) : (
              <EmptyState compact icon={<CheckCircle />} title="Nothing waiting on the client" />
            )}
          </section>

          {resolved.length > 0 && (
            <section>
              <SectionHeader title={`Resolved (${resolved.length})`} />
              <div className="space-y-3">
                {resolved.map((approval) => (
                  <ApprovalCard key={approval.id} approval={approval} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function ApprovalCard({ approval }: { approval: any }) {
  return (
    <Card padding="sm">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-medium text-ink-primary">{approval.title}</h3>
          <Badge tone={statusTone(approval.status)} dot>
            {humanize(approval.status)}
          </Badge>
        </div>
        <p className="text-xs text-ink-muted">
          {humanize(approval.type)} · Requested by {approval.requestedBy.name} ·{" "}
          {formatDate(approval.createdAt)}
        </p>
        {approval.deliverable && (
          <p className="mt-1 text-xs text-ink-secondary">Deliverable: {approval.deliverable.title}</p>
        )}
        {approval.description && <p className="mt-2 text-sm text-ink-secondary">{approval.description}</p>}
        {approval.responses[0] && (
          <p className="mt-2 text-xs text-ink-muted">
            Last response: {approval.responses[0].clientUser?.name || "Team"} —{" "}
            {formatDate(approval.responses[0].createdAt)}
          </p>
        )}
      </div>
    </Card>
  );
}
