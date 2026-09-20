"use client";

import { cn } from "@/lib/utils";
import type { StrategyItem } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/layout/header";
import { Target } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  MEDIA_TARGET: "Media Targets",
  INFLUENCER: "Influencer Opportunities",
  EVENT: "Events",
  BRAND_OPPORTUNITY: "Brand Opportunities",
  POSITIONING: "Positioning Angles",
  OTHER: "Other",
};

type Props = {
  byCategory: Record<string, StrategyItem[]>;
  clientId: string;
};

export function StrategyWishlist({ byCategory, clientId: _clientId }: Props) {
  const categories = Object.entries(byCategory).filter(([, items]) => items.length > 0);

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={<Target />}
        title="No strategy items yet"
        description="Build your preparation month wishlist."
      />
    );
  }

  return (
    <div className="space-y-6">
      {categories.map(([category, items]) => (
        <section key={category}>
          <SectionHeader
            title={CATEGORY_LABELS[category] ?? category}
            actions={<span className="tabular text-xs text-ink-muted">{items.length}</span>}
          />
          <Card padding="none">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <StrategyRow key={item.id} item={item} />
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}

function StrategyRow({ item }: { item: StrategyItem }) {
  return (
    <li className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-1">
      {/* Priority indicator */}
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          item.priority >= 8 ? "bg-ink-primary" : item.priority >= 5 ? "bg-ink-secondary" : "bg-border-strong"
        )}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-primary">{item.title}</p>
        {item.description && <p className="mt-0.5 truncate text-xs text-ink-muted">{item.description}</p>}
      </div>

      <Badge size="xs" tone={statusTone(item.status)} className="shrink-0">
        {humanize(item.status)}
      </Badge>

      {item.targetDate && (
        <span className="tabular shrink-0 text-xs text-ink-muted">
          {new Date(item.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      )}
    </li>
  );
}
