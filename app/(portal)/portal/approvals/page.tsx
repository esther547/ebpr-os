import { redirect } from "next/navigation";
import { getCurrentClientUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, cn } from "@/lib/utils";
import { ApprovalStatus } from "@prisma/client";

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
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-primary">Approvals</h1>
        {pending.length > 0 && (
          <p className="mt-1 text-ink-secondary">
            {pending.length} item{pending.length !== 1 ? "s" : ""} awaiting your review
          </p>
        )}
      </div>

      {pending.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Awaiting Review
          </h2>
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
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Resolved
          </h2>
          <div className="space-y-3">
            {resolved.map((approval) => (
              <div
                key={approval.id}
                className="flex items-center justify-between rounded-lg border border-border bg-white px-5 py-4"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-0.5">
                    {TYPE_LABELS[approval.type] ?? approval.type}
                  </p>
                  <p className="font-medium text-sm text-ink-primary">
                    {approval.title}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {formatDate(approval.updatedAt)}
                  </p>
                </div>
                <ApprovalStatusBadge status={approval.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {approvals.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
          <p className="text-sm text-ink-muted">No approvals yet.</p>
        </div>
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
    <div className="rounded-lg border border-ink-primary bg-white p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
            {TYPE_LABELS[approval.type] ?? approval.type} · Awaiting Approval
          </p>
          <h3 className="text-lg font-semibold text-ink-primary">
            {approval.title}
          </h3>
          {approval.description && (
            <p className="mt-1 text-sm text-ink-secondary">
              {approval.description}
            </p>
          )}
          <p className="mt-1 text-xs text-ink-muted">
            Sent by {approval.requestedBy.name} · {formatDate(approval.createdAt)}
          </p>
        </div>
      </div>

      {/* Content preview */}
      {approval.content && (
        <div className="mb-5 rounded-md bg-surface-2 p-4 text-sm text-ink-secondary whitespace-pre-wrap">
          {approval.content}
        </div>
      )}

      {/* File */}
      {approval.fileUrl && (
        <a
          href={approval.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-5 flex items-center gap-2 text-sm font-medium text-ink-primary hover:underline"
        >
          View Attachment →
        </a>
      )}

      {/* Actions */}
      <form action={`/api/approvals/${approval.id}/respond`} method="POST">
        <input type="hidden" name="clientUserId" value={clientUserId} />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            name="status"
            value="APPROVED"
            className="inline-flex h-9 items-center rounded-md bg-ink-primary px-5 text-sm font-medium text-ink-inverted hover:bg-ink-primary/90 transition-colors"
          >
            Approve
          </button>
          <button
            type="submit"
            name="status"
            value="REVISION_REQUESTED"
            className="inline-flex h-9 items-center rounded-md border border-border bg-white px-5 text-sm font-medium text-ink-secondary hover:border-border-strong transition-colors"
          >
            Request Revision
          </button>
          <button
            type="submit"
            name="status"
            value="REJECTED"
            className="inline-flex h-9 items-center rounded-md border border-border bg-white px-5 text-sm font-medium text-red-600 hover:border-red-200 transition-colors"
          >
            Reject
          </button>
        </div>
      </form>
    </div>
  );
}

function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const styles: Record<ApprovalStatus, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-green-50 text-green-700",
    REJECTED: "bg-red-50 text-red-600",
    REVISION_REQUESTED: "bg-blue-50 text-blue-700",
  };
  const labels: Record<ApprovalStatus, string> = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    REVISION_REQUESTED: "Revision Requested",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0", styles[status])}>
      {labels[status]}
    </span>
  );
}
