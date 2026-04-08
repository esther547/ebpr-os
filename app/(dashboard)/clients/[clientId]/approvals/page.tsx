import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, cn } from "@/lib/utils";
import { CheckCircle, XCircle, Clock, RotateCw } from "lucide-react";

type Props = { params: { clientId: string } };

export const metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { style: string; icon: React.ReactNode; label: string }> = {
  PENDING: {
    style: "bg-amber-50 text-amber-700",
    icon: <Clock className="h-3.5 w-3.5" />,
    label: "Pending",
  },
  APPROVED: {
    style: "bg-green-50 text-green-700",
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    label: "Approved",
  },
  REJECTED: {
    style: "bg-red-50 text-red-600",
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: "Rejected",
  },
  REVISION_REQUESTED: {
    style: "bg-blue-50 text-blue-700",
    icon: <RotateCw className="h-3.5 w-3.5" />,
    label: "Revision Requested",
  },
};

export default async function ClientApprovalsPage({ params }: Props) {
  await requireUser();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, name: true },
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
    <div>
      {/* Pending */}
      <section className="mb-8">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Pending Approvals ({pending.length})
        </h2>
        {pending.length > 0 ? (
          <div className="space-y-3">
            {pending.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <p className="text-sm text-ink-muted">No pending approvals</p>
          </div>
        )}
      </section>

      {/* Resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Resolved ({resolved.length})
          </h2>
          <div className="space-y-3">
            {resolved.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))}
          </div>
        </section>
      )}

      {approvals.length === 0 && (
        <div className="rounded-lg border border-border bg-white p-12 text-center">
          <CheckCircle className="mx-auto h-8 w-8 text-ink-muted mb-3" />
          <p className="text-sm font-medium text-ink-primary">No approvals yet</p>
          <p className="text-xs text-ink-muted mt-1">Request approvals from the deliverables page</p>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ approval }: { approval: any }) {
  const config = STATUS_CONFIG[approval.status] || STATUS_CONFIG.PENDING;

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm text-ink-primary truncate">{approval.title}</h3>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium flex-shrink-0", config.style)}>
              {config.icon}
              {config.label}
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            {approval.type.replace("_", " ")} · Requested by {approval.requestedBy.name} · {formatDate(approval.createdAt)}
          </p>
          {approval.deliverable && (
            <p className="text-xs text-ink-secondary mt-1">
              Deliverable: {approval.deliverable.title}
            </p>
          )}
          {approval.description && (
            <p className="text-sm text-ink-secondary mt-2">{approval.description}</p>
          )}
          {approval.responses[0] && (
            <p className="text-xs text-ink-muted mt-2">
              Last response: {approval.responses[0].clientUser?.name || "Team"} — {formatDate(approval.responses[0].createdAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
