"use client";

import { cn } from "@/lib/utils";
import type { StrategyItem } from "@prisma/client";

const STATUS_STYLES: Record<string, string> = {
  IDEA: "bg-surface-2 text-ink-muted",
  APPROVED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-600",
  ON_HOLD: "bg-surface-2 text-ink-secondary",
};

export function StrategyBigWins({ items }: { items: StrategyItem[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">
          ★ Big Wins
        </span>
        <span className="text-xs text-ink-muted">{items.length}</span>
      </div>
      <div className="rounded-lg border border-border bg-white divide-y divide-border">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-1 transition-colors"
          >
            <span className="text-sm text-ink-muted flex-shrink-0">★</span>
            <p className="flex-1 text-sm font-medium text-ink-primary">
              {item.targetName ?? item.title}
            </p>
            {item.notes && (
              <p className="text-xs text-ink-muted truncate max-w-xs">{item.notes}</p>
            )}
            <span
              className={cn(
                "flex-shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-semibold capitalize",
                STATUS_STYLES[item.status] ?? "bg-surface-2 text-ink-muted"
              )}
            >
              {item.status.replace(/_/g, " ").toLowerCase()}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
