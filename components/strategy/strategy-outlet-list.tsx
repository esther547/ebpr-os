"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { StrategyItem, StrategyCategory } from "@prisma/client";

const STATUS_STYLES: Record<string, string> = {
  IDEA: "bg-surface-2 text-ink-muted",
  APPROVED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-600",
  ON_HOLD: "bg-surface-2 text-ink-secondary",
};

type Props = {
  title: string;
  items: StrategyItem[];
  category: StrategyCategory;
  defaultExpanded?: boolean;
};

const COLLAPSE_AT = 12;

export function StrategyOutletList({
  title,
  items,
  category,
  defaultExpanded = false,
}: Props) {
  const [showAll, setShowAll] = useState(defaultExpanded || items.length <= COLLAPSE_AT);

  const activeCount = items.filter((i) =>
    ["IN_PROGRESS", "APPROVED", "OUTREACH"].includes(i.status)
  ).length;
  const completedCount = items.filter((i) => i.status === "COMPLETED").length;

  const visible = showAll ? items : items.slice(0, COLLAPSE_AT);

  // Group by phase if any items have a phase set
  const hasPhases = items.some((i) => i.phase);
  const phase1 = items.filter((i) => i.phase === 1);
  const phase2 = items.filter((i) => i.phase === 2);
  const noPhase = items.filter((i) => !i.phase);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">
            {title}
          </span>
          <span className="text-xs text-ink-muted">{items.length}</span>
          {completedCount > 0 && (
            <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-2xs font-semibold text-green-700">
              {completedCount} done
            </span>
          )}
          {activeCount > 0 && (
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-2xs font-semibold text-amber-700">
              {activeCount} active
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        {hasPhases ? (
          // Grouped by phase
          <>
            {phase1.length > 0 && (
              <PhaseGroup label="Phase 1" items={phase1} />
            )}
            {phase2.length > 0 && (
              <PhaseGroup label="Phase 2" items={phase2} />
            )}
            {noPhase.length > 0 && (
              <div className="divide-y divide-border">
                {noPhase.map((item) => (
                  <OutletRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </>
        ) : (
          // Flat list, collapsible at 12+
          <div className="divide-y divide-border">
            {visible.map((item) => (
              <OutletRow key={item.id} item={item} />
            ))}
          </div>
        )}

        {!hasPhases && items.length > COLLAPSE_AT && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full border-t border-border py-2.5 text-xs font-medium text-ink-muted hover:text-ink-primary hover:bg-surface-1 transition-colors"
          >
            {showAll
              ? "Show less ▲"
              : `Show all ${items.length} items ▼`}
          </button>
        )}
      </div>
    </section>
  );
}

function PhaseGroup({
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
        <span className="ml-2 text-2xs text-ink-muted">{items.length}</span>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <OutletRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function OutletRow({ item }: { item: StrategyItem }) {
  const name = item.targetName ?? item.title;

  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-surface-1 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-primary truncate">{name}</p>
        {item.scheduledDate && (
          <p className="text-2xs text-ink-muted">
            {new Date(item.scheduledDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {item.episodeNumber && ` · Ep ${item.episodeNumber}`}
            {item.eventLocation && ` · ${item.eventLocation}`}
          </p>
        )}
        {item.notes && (
          <p className="text-2xs text-ink-muted truncate">{item.notes}</p>
        )}
      </div>
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
