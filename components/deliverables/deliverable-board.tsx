"use client";

import Link from "next/link";
import { cn, formatDate, DELIVERABLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";

const COLUMNS = [
  "IDEA",
  "OUTREACH",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

type Props = {
  deliverables: any[];
  clientId: string;
  target: number;
  runnerNeededIds?: string[];
};

export function DeliverableBoard({ deliverables, clientId, target, runnerNeededIds = [] }: Props) {
  const runnerNeeded = new Set(runnerNeededIds);
  const byStatus = COLUMNS.reduce(
    (acc, status) => {
      acc[status] = deliverables.filter((d: any) => d.status === status);
      return acc;
    },
    {} as Record<string, any[]>
  );

  const completed = byStatus.COMPLETED.length;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {COLUMNS.map((status) => {
            const items = byStatus[status];

            return (
              <div key={status} className="w-72 shrink-0">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge tone={statusTone(status)} dot>
                    {DELIVERABLE_STATUS_LABELS[status as keyof typeof DELIVERABLE_STATUS_LABELS]}
                  </Badge>
                  <span className="tabular text-xs font-medium text-ink-muted">{items.length}</span>
                </div>

                <div className="space-y-2">
                  {items.map((d) => (
                    <DeliverableCard
                      key={d.id}
                      deliverable={d}
                      clientId={clientId}
                      needsRunner={runnerNeeded.has(d.id)}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
                      <p className="text-xs text-ink-muted">No items</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pacing summary */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <span>
          <span className="tabular font-semibold text-ink-primary">{completed}</span> of{" "}
          <span className="tabular font-semibold text-ink-primary">{target}</span> completed this month
        </span>
        {completed >= target && <Badge tone="success">Target reached</Badge>}
      </div>
    </div>
  );
}

function DeliverableCard({
  deliverable,
  clientId,
  needsRunner,
}: {
  deliverable: any;
  clientId: string;
  needsRunner?: boolean;
}) {
  const assigneeName: string | undefined = deliverable.assignee?.name;

  return (
    <Link href={`/clients/${clientId}/deliverables/${deliverable.id}`} className="block rounded-xl">
      <Card interactive padding="sm" className={cn(needsRunner && "border-amber-300")}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="eyebrow truncate">
            {DELIVERABLE_TYPE_LABELS[deliverable.type as keyof typeof DELIVERABLE_TYPE_LABELS] ??
              deliverable.type}
          </span>
          {needsRunner && (
            <Badge tone="warning" size="xs">
              Runner needed
            </Badge>
          )}
        </div>

        <p className="text-sm font-medium leading-snug text-ink-primary">{deliverable.title}</p>

        {deliverable.outcome && (
          <p className="mt-1.5 line-clamp-2 text-xs text-ink-secondary">{deliverable.outcome}</p>
        )}

        {deliverable.dueDate && (
          <p className="mt-2 text-xs text-ink-muted">Due {formatDate(deliverable.dueDate)}</p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
          {assigneeName ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xs font-semibold text-ink-secondary ring-1 ring-inset ring-border">
                {assigneeName.trim().charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-xs text-ink-muted">{assigneeName.split(" ")[0]}</span>
            </div>
          ) : (
            <span className="text-xs text-ink-muted">Unassigned</span>
          )}

          <div className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
            {deliverable._count?.tasks > 0 && <span className="tabular">{deliverable._count.tasks} tasks</span>}
            {deliverable._count?.comments > 0 && (
              <span className="tabular">{deliverable._count.comments} notes</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
