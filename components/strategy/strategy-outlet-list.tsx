"use client";

import { useState } from "react";
import type { StrategyItem, StrategyCategory } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { SectionHeader } from "@/components/layout/header";
import { ContactToggle, StrategyItemContact, useRowContact } from "./contact-field";

type Props = {
  title: string;
  items: StrategyItem[];
  category: StrategyCategory;
  defaultExpanded?: boolean;
  /** Per-row internal "Contacto / fuente" toggle (admins/strategists only). */
  showContacts?: boolean;
};

const COLLAPSE_AT = 12;

export function StrategyOutletList({ title, items, category: _category, defaultExpanded = false, showContacts = false }: Props) {
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
      <SectionHeader
        title={title}
        actions={
          <div className="flex items-center gap-2">
            <span className="tabular text-xs text-ink-muted">{items.length}</span>
            {completedCount > 0 && (
              <Badge size="xs" tone="success">
                {completedCount} done
              </Badge>
            )}
            {activeCount > 0 && (
              <Badge size="xs" tone="warning">
                {activeCount} active
              </Badge>
            )}
          </div>
        }
      />

      <Card padding="none" className="overflow-hidden">
        {hasPhases ? (
          <>
            {phase1.length > 0 && <PhaseGroup label="Phase 1" items={phase1} showContacts={showContacts} />}
            {phase2.length > 0 && <PhaseGroup label="Phase 2" items={phase2} showContacts={showContacts} />}
            {noPhase.length > 0 && (
              <ul className="divide-y divide-border">
                {noPhase.map((item) => (
                  <OutletRow key={item.id} item={item} showContacts={showContacts} />
                ))}
              </ul>
            )}
          </>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((item) => (
              <OutletRow key={item.id} item={item} showContacts={showContacts} />
            ))}
          </ul>
        )}

        {!hasPhases && items.length > COLLAPSE_AT && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="w-full border-t border-border py-2.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-1 hover:text-ink-primary"
          >
            {showAll ? "Show less" : `Show all ${items.length} items`}
          </button>
        )}
      </Card>
    </section>
  );
}

function PhaseGroup({ label, items, showContacts }: { label: string; items: StrategyItem[]; showContacts: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-5 py-2">
        <span className="eyebrow">{label}</span>
        <span className="tabular text-2xs text-ink-muted">{items.length}</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <OutletRow key={item.id} item={item} showContacts={showContacts} />
        ))}
      </ul>
    </div>
  );
}

function OutletRow({ item, showContacts }: { item: StrategyItem; showContacts: boolean }) {
  const name = item.targetName ?? item.title;
  const contact = useRowContact(item);

  return (
    <li className="transition-colors hover:bg-surface-1">
      <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-primary">{name}</p>
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
          {item.notes && <p className="truncate text-2xs text-ink-muted">{item.notes}</p>}
        </div>
        {showContacts && <ContactToggle open={contact.open} onToggle={contact.toggle} hasContact={contact.hasContact} />}
        <Badge size="xs" tone={statusTone(item.status)} className="shrink-0">
          {humanize(item.status)}
        </Badge>
      </div>
      {showContacts && contact.open && (
        <div className="px-4 pb-3 sm:px-5">
          <StrategyItemContact collapsible={false} item={contact.item} onChange={contact.setValue} />
        </div>
      )}
    </li>
  );
}
