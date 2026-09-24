"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/layout/header";
import { NavTabs } from "@/components/ui/tabs";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { currentCycle, cycleLabel } from "@/lib/cycles";
import { availabilityBadgeLabel, type AvailabilityNow } from "@/lib/client-availability-format";
import { ClientActions } from "./client-actions";
import { ShareMonitorButton } from "./share-monitor-button";
import { ClientWishlistButton } from "@/components/strategy/client-wishlist-button";

export type ClientHeaderClient = {
  id: string;
  name: string;
  status: string;
  monthlyTarget: number;
  cycleDay?: number | null;
  industry?: string | null;
  goalsOwed?: number;
  focusNote?: string | null;
  agendaDocUrl?: string | null;
};

export type ClientTabCounts = Partial<
  Record<
    "deliverables" | "strategy" | "suggestions" | "agenda" | "tasks" | "campaigns" | "approvals" | "files",
    number
  >
>;

/**
 * Shared header for every client sub-page: breadcrumbs, name, status, actions and
 * the section tab row. Presentation only — the actions it renders keep their own behaviour.
 */
export function ClientHeader({
  client,
  counts = {},
  actions,
  availabilityNow,
}: {
  client: ClientHeaderClient;
  counts?: ClientTabCounts;
  actions?: React.ReactNode;
  /** The OFF/TRAVEL window the client is in today (Miami), computed server-side. */
  availabilityNow?: AvailabilityNow;
}) {
  const pathname = usePathname() ?? "";
  const base = `/clients/${client.id}`;
  // The overview href carries a hash so it is never a path prefix of the other tabs.
  const overviewHref = `${base}#overview`;

  const items = [
    { href: overviewHref, label: "Overview" },
    { href: `${base}/deliverables`, label: "Deliverables", count: counts.deliverables },
    { href: `${base}/strategy`, label: "Strategy", count: counts.strategy },
    { href: `${base}/suggestions`, label: "Sugerencias", count: counts.suggestions },
    { href: `${base}/agenda`, label: "Agenda", count: counts.agenda },
    { href: `${base}/tasks`, label: "Tasks", count: counts.tasks },
    { href: `${base}/campaigns`, label: "Campaigns", count: counts.campaigns },
    { href: `${base}/approvals`, label: "Approvals", count: counts.approvals },
    { href: `${base}/files`, label: "Files", count: counts.files },
    { href: `${base}/onboarding`, label: "Onboarding" },
  ];

  const section = items.find(
    (item) =>
      item.href !== overviewHref &&
      (pathname === item.href || pathname.startsWith(item.href + "/"))
  );

  return (
    <PageHeader
      breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: client.name }]}
      title={client.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={statusTone(client.status)} dot>
            {humanize(client.status)}
          </Badge>
          {availabilityNow && (
            <a href={`${base}#disponibilidad`} title="Disponibilidad y viajes">
              <Badge tone={availabilityNow.kind === "OFF" ? "danger" : "info"} dot>
                {availabilityBadgeLabel(availabilityNow)}
              </Badge>
            </a>
          )}
          {client.industry && <span>{client.industry}</span>}
          {client.goalsOwed ? (
            <Badge tone="danger" dot>Debe {client.goalsOwed} meta{client.goalsOwed !== 1 ? "s" : ""}</Badge>
          ) : null}
          {client.focusNote && <Badge tone="warning">{client.focusNote}</Badge>}
          {client.agendaDocUrl && (
            <a href={client.agendaDocUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-ink-primary underline-offset-2 hover:underline">Agenda doc</a>
          )}
          <span className="text-ink-muted">
            {client.monthlyTarget > 0 ? (
              <>Target <span className="tabular">{client.monthlyTarget}</span> deliverables/month</>
            ) : (
              <>Preparation month</>
            )}
            {client.cycleDay && client.cycleDay !== 1 ? <> · cycle {cycleLabel(currentCycle(client.cycleDay), client.cycleDay).split(" · ")[1]} (corte {client.cycleDay})</> : null}
          </span>
        </span>
      }
      actions={
        <>
          <ClientActions
            clientId={client.id}
            clientName={client.name}
            industry={client.industry}
            monthlyTarget={client.monthlyTarget}
            cycleDay={client.cycleDay ?? null}
            goalsOwed={client.goalsOwed ?? 0}
            focusNote={client.focusNote ?? null}
            agendaDocUrl={client.agendaDocUrl ?? null}
            status={client.status}
          />
          {/* /clients/* is admin/strategist-only, so the internal contact field can show */}
          <ClientWishlistButton clientId={client.id} showContact />
          <ShareMonitorButton clientId={client.id} />
          {actions}
        </>
      }
    >
      <NavTabs items={items} current={section ? section.href : overviewHref} />
    </PageHeader>
  );
}
