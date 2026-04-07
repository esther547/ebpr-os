"use client";

import { useState } from "react";
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

type Props = {
  byCategory: Map<string, StrategyItem[]>;
};

export function StrategyBrandDeals({ byCategory }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const totalBrands = Array.from(byCategory.values()).reduce(
    (s, items) => s + items.length,
    0
  );

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">
          Brand Deals
        </span>
        <span className="text-xs text-ink-muted">
          {byCategory.size} categories · {totalBrands} brands
        </span>
      </div>

      <div className="rounded-lg border border-border bg-white divide-y divide-border overflow-hidden">
        {Array.from(byCategory.entries()).map(([category, items]) => {
          const isOpen = expanded.has(category);
          const confirmedCount = items.filter((i) =>
            ["IN_PROGRESS", "APPROVED", "COMPLETED"].includes(i.status)
          ).length;

          return (
            <div key={category}>
              {/* Category row */}
              <button
                onClick={() => toggle(category)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-1 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink-primary">
                    {category}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {items.length} brand{items.length !== 1 ? "s" : ""}
                  </span>
                  {confirmedCount > 0 && (
                    <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-2xs font-semibold text-green-700">
                      {confirmedCount} active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Preview names */}
                  {!isOpen && (
                    <span className="text-xs text-ink-muted truncate max-w-[260px]">
                      {items
                        .slice(0, 4)
                        .map((i) => i.targetName ?? i.title)
                        .join(" · ")}
                      {items.length > 4 && ` +${items.length - 4}`}
                    </span>
                  )}
                  <span className="text-ink-muted text-xs ml-2">
                    {isOpen ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {/* Expanded brand list */}
              {isOpen && (
                <div className="px-5 pb-3 bg-surface-1">
                  <div className="flex flex-wrap gap-2 pt-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1.5"
                      >
                        <span className="text-xs font-medium text-ink-primary">
                          {item.targetName ?? item.title}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-2xs font-semibold capitalize",
                            STATUS_STYLES[item.status] ??
                              "bg-surface-2 text-ink-muted"
                          )}
                        >
                          {item.status.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
