"use client";

import { cn, formatDate } from "@/lib/utils";
import type { StrategyItem } from "@prisma/client";

const STATUS_STYLES: Record<string, string> = {
  IDEA: "bg-surface-2 text-ink-muted",
  APPROVED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-600",
  ON_HOLD: "bg-surface-2 text-ink-secondary",
};

export function StrategyEventsList({ items }: { items: StrategyItem[] }) {
  const sorted = [...items].sort((a, b) => {
    if (!a.scheduledDate) return 1;
    if (!b.scheduledDate) return -1;
    return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
  });

  const phase1 = sorted.filter((i) => i.phase === 1);
  const phase2 = sorted.filter((i) => i.phase === 2);
  const noPhase = sorted.filter((i) => !i.phase);

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">
          Events
        </span>
        <span className="text-xs text-ink-muted">{items.length}</span>
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        {phase1.length > 0 && (
          <EventPhaseGroup label="Phase 1" items={phase1} />
        )}
        {phase2.length > 0 && (
          <EventPhaseGroup label="Phase 2" items={phase2} />
        )}
        {noPhase.length > 0 && (
          <div className="divide-y divide-border">
            {noPhase.map((item) => (
              <EventRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function EventPhaseGroup({
  label,
  items,
}: {
  label: string;
  items: StrategyItem[];
}) {
  return (
    <div>
      <div className="border-b border-border bg-surface-1 px-5 py-2">
        <span className="text-2xs font-bold uppercase tracking-widest text-ink-muted">
          {label}
        </span>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <EventRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function EventRow({ item }: { item: StrategyItem }) {
  const name = item.targetName ?? item.title;

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-1 transition-colors">
      {/* Date */}
      <div className="flex-shrink-0 w-20 text-right">
        {item.scheduledDate ? (
          <p className="text-xs font-semibold text-ink-primary">
            {new Date(item.scheduledDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        ) : (
          <p className="text-xs text-ink-muted">TBC</p>
        )}
      </div>

      {/* Name + location */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-primary">{name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {item.eventLocation && (
            <span className="text-xs text-ink-muted">{item.eventLocation}</span>
          )}
          {item.notes && (
            <span className="text-xs text-ink-muted truncate">· {item.notes}</span>
          )}
        </div>
      </div>

      {/* Status */}
      <span
        className={cn(
          "flex-shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-semibold capitalize",
          STATUS_STYLES[item.status] ?? "bg-surface-2 text-ink-muted"
        )}
      >
        {item.status.replace(/_/g, " ").toLowerCase()}
      </span>
    </div>
  );
}
