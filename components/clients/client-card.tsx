import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import type { ClientWithCounts } from "@/types";

const STATUS_STYLES = {
  PROSPECT: "bg-surface-2 text-ink-secondary",
  ACTIVE: "bg-green-50 text-green-700",
  PAUSED: "bg-amber-50 text-amber-700",
  CHURNED: "bg-red-50 text-red-600",
};

const STATUS_LABELS = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CHURNED: "Churned",
};

type Props = { client: ClientWithCounts };

export function ClientCard({ client }: Props) {
  return (
    <Link
      href={`/clients/${client.id}`}
      className="group block rounded-lg border border-border bg-white p-5 hover:border-border-strong hover:shadow-sm transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-ink-primary group-hover:text-ink-primary">
            {client.name}
          </h3>
          {client.industry && (
            <p className="mt-0.5 text-sm text-ink-muted truncate">
              {client.industry}
            </p>
          )}
        </div>
        <span
          className={cn(
            "flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
            STATUS_STYLES[client.status]
          )}
        >
          {STATUS_LABELS[client.status]}
        </span>
      </div>

      {/* Onboarding status */}
      {client.onboarding && client.status === "PROSPECT" && (
        <p className="mb-3 text-xs text-ink-muted">
          Onboarding:{" "}
          <span className="font-medium text-ink-secondary">
            {client.onboarding.status.replace(/_/g, " ").toLowerCase()}
          </span>
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-ink-muted">
        <span>
          <span className="font-semibold text-ink-primary">
            {client._count.deliverables}
          </span>{" "}
          deliverables
        </span>
        <span>
          <span className="font-semibold text-ink-primary">
            {client._count.campaigns}
          </span>{" "}
          campaigns
        </span>
        <span>
          <span className="font-semibold text-ink-primary">
            {client._count.contracts}
          </span>{" "}
          contracts
        </span>
      </div>
    </Link>
  );
}
