"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/layout/header";
import { NavTabs } from "@/components/ui/tabs";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { ClientActions } from "./client-actions";
import { ShareMonitorButton } from "./share-monitor-button";

export type ClientHeaderClient = {
  id: string;
  name: string;
  status: string;
  monthlyTarget: number;
  industry?: string | null;
};

export type ClientTabCounts = Partial<
  Record<
    "deliverables" | "strategy" | "agenda" | "tasks" | "campaigns" | "approvals" | "files",
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
}: {
  client: ClientHeaderClient;
  counts?: ClientTabCounts;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const base = `/clients/${client.id}`;
  // The overview href carries a hash so it is never a path prefix of the other tabs.
  const overviewHref = `${base}#overview`;

  const items = [
    { href: overviewHref, label: "Overview" },
    { href: `${base}/deliverables`, label: "Deliverables", count: counts.deliverables },
    { href: `${base}/strategy`, label: "Strategy", count: counts.strategy },
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
          {client.industry && <span>{client.industry}</span>}
          <span className="text-ink-muted">
            Target <span className="tabular">{client.monthlyTarget}</span> deliverables/month
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
            status={client.status}
          />
          <ShareMonitorButton clientId={client.id} />
          {actions}
        </>
      }
    >
      <NavTabs items={items} current={section ? section.href : overviewHref} />
    </PageHeader>
  );
}
