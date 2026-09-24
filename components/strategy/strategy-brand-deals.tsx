"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { StrategyItem } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/header";
import { ContactToggle, StrategyItemContact, type ContactValue } from "./contact-field";

type Props = {
  groups: { category: string; items: StrategyItem[] }[];
  /** Per-brand internal "Contacto / fuente" toggle (admins/strategists only). */
  showContacts?: boolean;
};

export function StrategyBrandDeals({ groups, showContacts = false }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const totalBrands = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <section>
      <SectionHeader
        title="Brand Deals"
        actions={
          <span className="text-xs text-ink-muted">
            {groups.length} categories · {totalBrands} brands
          </span>
        }
      />

      <Card padding="none" className="overflow-hidden">
        <div className="divide-y divide-border">
          {groups.map(({ category, items }) => {
            const isOpen = expanded.has(category);
            const confirmedCount = items.filter((i) =>
              ["IN_PROGRESS", "APPROVED", "COMPLETED"].includes(i.status)
            ).length;

            return (
              <div key={category}>
                <button
                  type="button"
                  onClick={() => toggle(category)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-1"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <span className="text-sm font-semibold text-ink-primary">{category}</span>
                    <span className="text-xs text-ink-muted">
                      {items.length} brand{items.length !== 1 ? "s" : ""}
                    </span>
                    {confirmedCount > 0 && (
                      <Badge size="xs" tone="success">
                        {confirmedCount} active
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!isOpen && (
                      <span className="hidden max-w-[260px] truncate text-xs text-ink-muted sm:inline">
                        {items
                          .slice(0, 4)
                          .map((i) => i.targetName ?? i.title)
                          .join(" · ")}
                        {items.length > 4 && ` +${items.length - 4}`}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-ink-muted transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </div>
                </button>

                {isOpen && <BrandGroupItems items={items} showContacts={showContacts} />}
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

/** Brand chips of one category; the chip's contact toggle opens its field below. */
function BrandGroupItems({ items, showContacts }: { items: StrategyItem[]; showContacts: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  // Contacts saved while this group is open (so re-opening a chip shows them).
  const [contacts, setContacts] = useState<Record<string, ContactValue>>({});
  const current = selected ? items.find((i) => i.id === selected) : undefined;

  return (
    <div className="bg-surface-1 px-4 pb-4 pt-1 sm:px-5">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const has = !!(contacts[item.id]?.contactNotes ?? item.contactNotes)?.trim();
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border bg-white py-1 pl-2.5",
                showContacts ? "pr-1" : "pr-2.5 py-1.5",
                selected === item.id ? "border-ink-primary/40" : "border-border"
              )}
            >
              <span className="text-xs font-medium text-ink-primary">{item.targetName ?? item.title}</span>
              <Badge size="xs" tone={statusTone(item.status)}>
                {humanize(item.status)}
              </Badge>
              {showContacts && (
                <ContactToggle
                  open={selected === item.id}
                  onToggle={() => setSelected((s) => (s === item.id ? null : item.id))}
                  hasContact={has}
                  className="h-6 w-6"
                />
              )}
            </div>
          );
        })}
      </div>
      {showContacts && current && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-ink-primary">{current.targetName ?? current.title}</p>
          <StrategyItemContact collapsible={false}
            key={current.id}
            item={{ ...current, ...contacts[current.id] }}
            className="bg-white"
            onChange={(v) => setContacts((prev) => ({ ...prev, [current.id]: v }))}
          />
        </div>
      )}
    </div>
  );
}
