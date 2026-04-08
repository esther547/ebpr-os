"use client";

import { cn, DELIVERABLE_STATUS_LABELS, DELIVERABLE_STATUS_COLORS, DELIVERABLE_TYPE_LABELS } from "@/lib/utils";

const COLUMNS = [
  "IDEA",
  "OUTREACH",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

type Props = {
  deliverables: any[];
  clientId: string;
  target: number;
};

export function DeliverableBoard({ deliverables, clientId, target }: Props) {
  const byStatus = COLUMNS.reduce(
    (acc, status) => {
      acc[status] = deliverables.filter((d: any) => d.status === status);
      return acc;
    },
    {} as Record<string, any[]>
  );

  const completed = byStatus.COMPLETED.length;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {COLUMNS.map((status) => {
          const items = byStatus[status];
          const colors = DELIVERABLE_STATUS_COLORS[status as keyof typeof DELIVERABLE_STATUS_COLORS];

          return (
            <div key={status} className="w-72 flex-shrink-0">
              {/* Column header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn("h-2 w-2 rounded-full", colors.dot)}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                    {DELIVERABLE_STATUS_LABELS[status as keyof typeof DELIVERABLE_STATUS_LABELS]}
                  </span>
                </div>
                <span className="text-xs font-medium text-ink-muted">
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {items.map((d) => (
                  <DeliverableCard key={d.id} deliverable={d} clientId={clientId} />
                ))}
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center">
                    <p className="text-xs text-ink-muted">No items</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pacing summary */}
      <div className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
        <span className="font-semibold text-ink-primary">{completed}</span>
        <span>of</span>
        <span className="font-semibold text-ink-primary">{target}</span>
        <span>completed this month</span>
        {completed >= target && (
          <span className="ml-2 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            Target reached
          </span>
        )}
      </div>
    </div>
  );
}

function DeliverableCard({
  deliverable,
  clientId,
}: {
  deliverable: any;
  clientId: string;
}) {
  const colors = DELIVERABLE_STATUS_COLORS[deliverable.status as keyof typeof DELIVERABLE_STATUS_COLORS];

  return (
    <a
      href={`/clients/${clientId}/deliverables/${deliverable.id}`}
      className="block rounded-lg border border-border bg-white p-4 hover:border-border-strong hover:shadow-sm transition-all"
    >
      {/* Type badge */}
      <div className="mb-2">
        <span className="text-2xs font-semibold uppercase tracking-widest text-ink-muted">
          {DELIVERABLE_TYPE_LABELS[deliverable.type as keyof typeof DELIVERABLE_TYPE_LABELS]}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-ink-primary leading-snug">
        {deliverable.title}
      </p>

      {/* Outcome if completed */}
      {deliverable.outcome && (
        <p className="mt-1.5 text-xs text-ink-secondary line-clamp-2">
          {deliverable.outcome}
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        {/* Assignee */}
        {deliverable.assignee ? (
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full bg-surface-3 flex items-center justify-center text-2xs font-semibold text-ink-secondary">
              {deliverable.assignee.name[0].toUpperCase()}
            </div>
            <span className="text-xs text-ink-muted">
              {deliverable.assignee.name.split(" ")[0]}
            </span>
          </div>
        ) : (
          <span className="text-xs text-ink-muted">Unassigned</span>
        )}

        {/* Counts */}
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          {deliverable._count.tasks > 0 && (
            <span>{deliverable._count.tasks} tasks</span>
          )}
          {deliverable._count.comments > 0 && (
            <span>{deliverable._count.comments} notes</span>
          )}
        </div>
      </div>
    </a>
  );
}
