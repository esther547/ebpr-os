import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { ApprovalStatus } from "@prisma/client";
import { CheckSquare, Paperclip } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  STRATEGY_IDEA: "Strategy",
  PRESS_RELEASE: "Press Release",
  INTERVIEW_QUESTIONS: "Interview Questions",
  PROPOSAL: "Proposal",
  OTHER: "Review",
};

export default async function PortalApprovalsPage() {
  const clientUser = await getCurrentClientUser();
  if (!clientUser) redirect("/sign-in");
  if (!clientUser.isActive) redirect("/access-pending");

  const approvals = await db.approval.findMany({
    where: { clientId: clientUser.clientId },
    include: {
      requestedBy: { select: { name: true } },
      responses: {
        where: { clientUserId: clientUser.id },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = approvals.filter((a) => a.status === "PENDING");
  const resolved = approvals.filter((a) => a.status !== "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader
        className="pt-0 pb-0 sm:pt-0"
        title="Approvals"
        subtitle={
          pending.length > 0
            ? `${pending.length} item${pending.length !== 1 ? "s" : ""} awaiting your review`
            : undefined
        }
      />

      {pending.length > 0 && (
        <section>
          <SectionHeader title="Awaiting Review" />
          <div className="space-y-4">
            {pending.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                clientUserId={clientUser.id}
              />
            ))}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section>
          <SectionHeader title="Resolved" />
          <Card padding="none" className="divide-y divide-border">
            {resolved.map((approval) => (
              <div
                key={approval.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="eyebrow mb-0.5">{TYPE_LABELS[approval.type] ?? approval.type}</p>
                  <p className="text-sm font-medium text-ink-primary">{approval.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{formatDate(approval.updatedAt)}</p>
                </div>
                <ApprovalStatusBadge status={approval.status} />
              </div>
            ))}
          </Card>
        </section>
      )}

      {approvals.length === 0 && (
        <EmptyState
          icon={<CheckSquare />}
          title="No approvals yet"
          description="When your EBPR team sends something for your review, it will appear here."
        />
      )}
    </div>
  );
}

function ApprovalCard({
  approval,
  clientUserId,
}: {
  approval: {
    id: string;
    title: string;
    type: string;
    description: string | null;
    content: string | null;
    fileUrl: string | null;
    createdAt: Date;
    requestedBy: { name: string };
  };
  clientUserId: string;
}) {
  return (
    <Card padding="lg" className="border-ink-primary">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-1">{TYPE_LABELS[approval.type] ?? approval.type}</p>
          <h3 className="text-lg font-semibold text-ink-primary">{approval.title}</h3>
          {approval.description && (
            <p className="mt-1 max-w-prose text-sm text-ink-secondary">{approval.description}</p>
          )}
          <p className="mt-1 text-xs text-ink-muted">
            Sent by {approval.requestedBy.name} · {formatDate(approval.createdAt)}
          </p>
        </div>
        <Badge tone="warning" dot className="shrink-0 self-start">
          Awaiting Approval
        </Badge>
      </div>

      {/* Content preview */}
      {approval.content && (
        <div className="mb-5 whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-sm text-ink-secondary">
          {approval.content}
        </div>
      )}

      {/* File */}
      {approval.fileUrl && (
        <div className="mb-5">
          <Button asChild variant="link" size="sm" leftIcon={<Paperclip className="h-3.5 w-3.5" />}>
            <a href={approval.fileUrl} target="_blank" rel="noopener noreferrer">
              View Attachment
            </a>
          </Button>
        </div>
      )}

      {/* Actions */}
      <form action={`/api/approvals/${approval.id}/respond`} method="POST">
        <input type="hidden" name="clientUserId" value={clientUserId} />
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button type="submit" name="status" value="APPROVED">
            Approve
          </Button>
          <Button type="submit" name="status" value="REVISION_REQUESTED" variant="secondary">
            Request Revision
          </Button>
          <Button
            type="submit"
            name="status"
            value="REJECTED"
            variant="outline"
            className="text-red-600 hover:bg-red-50"
          >
            Reject
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const labels: Record<ApprovalStatus, string> = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    REVISION_REQUESTED: "Revision Requested",
  };
  return (
    <Badge tone={statusTone(status)} dot className="shrink-0">
      {labels[status]}
    </Badge>
  );
}
