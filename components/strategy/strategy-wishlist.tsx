"use client";

import { cn } from "@/lib/utils";
import type { StrategyItem } from "@prisma/client";

const CATEGORY_LABELS: Record<string, string> = {
  MEDIA_TARGET: "Media Targets",
  INFLUENCER: "Influencer Opportunities",
  EVENT: "Events",
  BRAND_OPPORTUNITY: "Brand Opportunities",
  POSITIONING: "Positioning Angles",
  OTHER: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  IDEA: "bg-surface-2 text-ink-muted",
  APPROVED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-600",
  ON_HOLD: "bg-surface-2 text-ink-secondary",
};

type Props = {
  byCategory: Record<string, StrategyItem[]>;
  clientId: string;
};

export function StrategyWishlist({ byCategory, clientId }: Props) {
  const categories = Object.entries(byCategory).filter(
    ([, items]) => items.length > 0
  );

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
        <p className="text-sm font-medium text-ink-primary">
          No strategy items yet
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Build your preparation month wishlist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(byCategory).map(([category, items]) => {
        if (items.length === 0) return null;
        return (
          <section key={category}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <span className="text-xs text-ink-muted">{items.length}</span>
            </div>
            <div className="rounded-lg border border-border bg-white divide-y divide-border">
              {items.map((item) => (
                <StrategyRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StrategyRow({ item }: { item: StrategyItem }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-surface-1 transition-colors">
      {/* Priority indicator */}
      <div
        className={cn(
          "h-1.5 w-1.5 flex-shrink-0 rounded-full",
          item.priority >= 8
            ? "bg-ink-primary"
            : item.priority >= 5
            ? "bg-ink-secondary"
            : "bg-border-strong"
        )}
      />

      {/* Title + description */}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-ink-primary">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-xs text-ink-muted truncate">
            {item.description}
          </p>
        )}
      </div>

      {/* Status */}
      <span
        className={cn(
          "flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
          STATUS_STYLES[item.status]
        )}
      >
        {item.status.replace(/_/g, " ").toLowerCase()}
      </span>

      {/* Target date */}
      {item.targetDate && (
        <span className="flex-shrink-0 text-xs text-ink-muted">
          {new Date(item.targetDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      )}
    </div>
  );
}
