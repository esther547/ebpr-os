"use client";

import type { StrategyItem } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/header";

export function StrategyBigWins({ items }: { items: StrategyItem[] }) {
  return (
    <section>
      <SectionHeader
        title="Big Wins"
        actions={<span className="tabular text-xs text-ink-muted">{items.length}</span>}
      />
      <Card padding="none">
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-surface-1"
            >
              <p className="min-w-0 flex-1 text-sm font-medium text-ink-primary">
                {item.targetName ?? item.title}
              </p>
              {item.notes && <p className="max-w-xs truncate text-xs text-ink-muted">{item.notes}</p>}
              <Badge size="xs" tone={statusTone(item.status)}>
                {humanize(item.status)}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
