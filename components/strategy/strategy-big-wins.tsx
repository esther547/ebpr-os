"use client";

import type { StrategyItem } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/header";
import { ContactToggle, StrategyItemContact, useRowContact } from "./contact-field";

export function StrategyBigWins({ items, showContacts = false }: { items: StrategyItem[]; showContacts?: boolean }) {
  return (
    <section>
      <SectionHeader
        title="Big Wins"
        actions={<span className="tabular text-xs text-ink-muted">{items.length}</span>}
      />
      <Card padding="none">
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <BigWinRow key={item.id} item={item} showContacts={showContacts} />
          ))}
        </ul>
      </Card>
    </section>
  );
}

function BigWinRow({ item, showContacts }: { item: StrategyItem; showContacts: boolean }) {
  const contact = useRowContact(item);
  return (
    <li className="transition-colors hover:bg-surface-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 sm:px-5">
        <p className="min-w-0 flex-1 text-sm font-medium text-ink-primary">{item.targetName ?? item.title}</p>
        {item.notes && <p className="max-w-xs truncate text-xs text-ink-muted">{item.notes}</p>}
        <div className="flex shrink-0 items-center gap-2">
          {showContacts && <ContactToggle open={contact.open} onToggle={contact.toggle} hasContact={contact.hasContact} />}
          <Badge size="xs" tone={statusTone(item.status)}>
            {humanize(item.status)}
          </Badge>
        </div>
      </div>
      {showContacts && contact.open && (
        <div className="px-4 pb-3 sm:px-5">
          <StrategyItemContact collapsible={false} item={contact.item} onChange={contact.setValue} />
        </div>
      )}
    </li>
  );
}
