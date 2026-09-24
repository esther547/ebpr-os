"use client";

import type { StrategyItem } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/header";
import { ContactToggle, StrategyItemContact, useRowContact } from "./contact-field";

export function StrategyEventsList({ items, showContacts = false }: { items: StrategyItem[]; showContacts?: boolean }) {
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
      <SectionHeader
        title="Events"
        actions={<span className="tabular text-xs text-ink-muted">{items.length}</span>}
      />

      <Card padding="none" className="overflow-hidden">
        {phase1.length > 0 && <EventPhaseGroup label="Phase 1" items={phase1} showContacts={showContacts} />}
        {phase2.length > 0 && <EventPhaseGroup label="Phase 2" items={phase2} showContacts={showContacts} />}
        {noPhase.length > 0 && (
          <ul className="divide-y divide-border">
            {noPhase.map((item) => (
              <EventRow key={item.id} item={item} showContacts={showContacts} />
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

function EventPhaseGroup({ label, items, showContacts }: { label: string; items: StrategyItem[]; showContacts: boolean }) {
  return (
    <div>
      <div className="border-b border-border bg-surface-2/60 px-5 py-2">
        <span className="eyebrow">{label}</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <EventRow key={item.id} item={item} showContacts={showContacts} />
        ))}
      </ul>
    </div>
  );
}

function EventRow({ item, showContacts }: { item: StrategyItem; showContacts: boolean }) {
  const name = item.targetName ?? item.title;
  const contact = useRowContact(item);

  return (
    <li className="transition-colors hover:bg-surface-1">
      <div className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
        <div className="w-14 shrink-0 text-right sm:w-20">
          {item.scheduledDate ? (
            <p className="tabular text-xs font-semibold text-ink-primary">
              {new Date(item.scheduledDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
          ) : (
            <p className="text-xs text-ink-muted">TBC</p>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-primary">{name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            {item.eventLocation && <span className="text-xs text-ink-muted">{item.eventLocation}</span>}
            {item.notes && <span className="truncate text-xs text-ink-muted">· {item.notes}</span>}
          </div>
        </div>

        {showContacts && <ContactToggle open={contact.open} onToggle={contact.toggle} hasContact={contact.hasContact} />}
        <Badge size="xs" tone={statusTone(item.status)} className="shrink-0">
          {humanize(item.status)}
        </Badge>
      </div>
      {showContacts && contact.open && (
        <div className="px-4 pb-3 sm:pl-[7.25rem] sm:pr-5">
          <StrategyItemContact collapsible={false} item={contact.item} onChange={contact.setValue} />
        </div>
      )}
    </li>
  );
}
