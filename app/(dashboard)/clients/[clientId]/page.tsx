import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { DeliverablePacingBar } from "@/components/deliverables/pacing-bar";
import { cn, formatDate, monthLabel } from "@/lib/utils";
import { currentMonthYear } from "@/lib/utils";
import { ClientStatus } from "@prisma/client";
import { ShareMonitorButton } from "@/components/clients/share-monitor-button";

type Props = { params: { clientId: string } };

export async function generateMetadata({ params }: Props) {
  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { name: true },
  });
  return { title: client?.name ?? "Client" };
}

const CLIENT_TABS = [
  { label: "Overview", href: "" },
  { label: "Onboarding", href: "/onboarding" },
  { label: "Strategy", href: "/strategy" },
  { label: "Agenda", href: "/agenda" },
  { label: "Campaigns", href: "/campaigns" },
  { label: "Deliverables", href: "/deliverables" },
  { label: "Tasks", href: "/tasks" },
  { label: "Approvals", href: "/approvals" },
  { label: "Files", href: "/files" },
];

export default async function ClientPage({ params }: Props) {
  await requireUser();

  const { month, year } = currentMonthYear();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    include: {
      contacts: true,
      contracts: { orderBy: { createdAt: "desc" }, take: 1 },
      onboarding: { include: { checklistItems: true } },
      campaigns: {
        where: { status: { in: ["PREPARATION", "ACTIVE"] } },
        take: 3,
      },
      _count: {
        select: {
          deliverables: true,
          strategyItems: true,
          files: true,
        },
      },
    },
  });

  if (!client) notFound();

  // Monthly deliverable pacing
  const deliverables = await db.deliverable.findMany({
    where: { clientId: params.clientId, month, year },
    select: { status: true },
  });

  const completed = deliverables.filter((d) => d.status === "COMPLETED").length;
  const inProgress = deliverables.filter(
    (d) => !["COMPLETED", "CANCELLED", "IDEA"].includes(d.status)
  ).length;

  // Recent activity
  const activity = await db.activityLog.findMany({
    where: { clientId: params.clientId },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { user: { select: { name: true, avatar: true } } },
  });

  return (
    <>
      <div className="flex items-start justify-between py-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-ink-primary">{client.name}</h1>
            <ClientStatusBadge status={client.status} />
          </div>
          {client.industry && (
            <p className="mt-0.5 text-sm text-ink-muted">{client.industry}</p>
          )}
        </div>
        <div className="flex gap-2">
          <ShareMonitorButton clientId={client.id} />
          <Link
            href={`/clients/${client.id}/deliverables`}
            className="inline-flex h-9 items-center rounded-md bg-ink-primary px-4 text-sm font-medium text-ink-inverted hover:bg-ink-primary/90 transition-colors"
          >
            + Deliverable
          </Link>
        </div>
      </div>

      {/* Sub-nav tabs */}
      <div className="mb-8 flex gap-1 border-b border-border">
        {CLIENT_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={`/clients/${client.id}${tab.href}`}
            className="px-4 py-2.5 text-sm font-medium text-ink-secondary hover:text-ink-primary border-b-2 border-transparent hover:border-ink-primary transition-colors"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left column (2/3) */}
        <div className="col-span-2 space-y-6">
          {/* Monthly Pacing */}
          <section className="rounded-lg border border-border bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ink-primary">
                {monthLabel(month, year)} Pacing
              </h2>
              <span className="text-sm text-ink-muted">
                Target: {client.monthlyTarget} deliverables
              </span>
            </div>
            <DeliverablePacingBar
              completed={completed}
              inProgress={inProgress}
              target={client.monthlyTarget}
            />
            <div className="mt-3 flex gap-6 text-sm">
              <span className="text-ink-muted">
                <span className="font-semibold text-green-700">{completed}</span>{" "}
                completed
              </span>
              <span className="text-ink-muted">
                <span className="font-semibold text-amber-700">{inProgress}</span>{" "}
                in progress
              </span>
              <span className="text-ink-muted">
                <span className="font-semibold text-ink-primary">
                  {deliverables.length}
                </span>{" "}
                total this month
              </span>
            </div>
          </section>

          {/* Active Campaigns */}
          {client.campaigns.length > 0 && (
            <section className="rounded-lg border border-border bg-white p-6">
              <h2 className="mb-4 font-semibold text-ink-primary">
                Active Campaigns
              </h2>
              <div className="space-y-3">
                {client.campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/clients/${client.id}/campaigns/${campaign.id}`}
                    className="flex items-center justify-between rounded-md border border-border p-3 hover:border-border-strong transition-colors"
                  >
                    <span className="font-medium text-sm text-ink-primary">
                      {campaign.name}
                    </span>
                    <CampaignStatusBadge status={campaign.status} />
                  </Link>
                ))}
              </div>
              <Link
                href={`/clients/${client.id}/campaigns`}
                className="mt-3 block text-sm text-ink-muted hover:text-ink-primary transition-colors"
              >
                View all campaigns →
              </Link>
            </section>
          )}

          {/* Recent Activity */}
          <section className="rounded-lg border border-border bg-white p-6">
            <h2 className="mb-4 font-semibold text-ink-primary">
              Recent Activity
            </h2>
            {activity.length === 0 ? (
              <p className="text-sm text-ink-muted">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((log) => (
                  <li key={log.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-xs font-semibold text-ink-secondary">
                      {log.user.name[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-ink-primary">
                        {log.user.name}
                      </span>{" "}
                      <span className="text-ink-secondary">{log.description}</span>
                      <p className="text-xs text-ink-muted">
                        {formatDate(log.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">
          {/* Client Info */}
          <section className="rounded-lg border border-border bg-white p-6">
            <h2 className="mb-4 font-semibold text-ink-primary">Client Info</h2>
            <dl className="space-y-3 text-sm">
              {client.website && (
                <div>
                  <dt className="text-ink-muted">Website</dt>
                  <dd className="font-medium text-ink-primary truncate">
                    {client.website}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-ink-muted">Monthly Target</dt>
                <dd className="font-medium text-ink-primary">
                  {client.monthlyTarget} deliverables
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Strategy Items</dt>
                <dd className="font-medium text-ink-primary">
                  {client._count.strategyItems}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Files</dt>
                <dd className="font-medium text-ink-primary">
                  {client._count.files}
                </dd>
              </div>
            </dl>
          </section>

          {/* Primary Contacts */}
          {client.contacts.length > 0 && (
            <section className="rounded-lg border border-border bg-white p-6">
              <h2 className="mb-4 font-semibold text-ink-primary">Contacts</h2>
              <ul className="space-y-3">
                {client.contacts.slice(0, 4).map((contact) => (
                  <li key={contact.id} className="text-sm">
                    <p className="font-medium text-ink-primary">{contact.name}</p>
                    {contact.role && (
                      <p className="text-ink-muted">{contact.role}</p>
                    )}
                    {contact.email && (
                      <p className="text-ink-muted truncate">{contact.email}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Latest Contract */}
          {client.contracts[0] && (
            <section className="rounded-lg border border-border bg-white p-6">
              <h2 className="mb-4 font-semibold text-ink-primary">Contract</h2>
              <ContractSummary contract={client.contracts[0]} />
              <Link
                href="/legal"
                className="mt-3 block text-sm text-ink-muted hover:text-ink-primary transition-colors"
              >
                View all contracts →
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const styles = {
    PROSPECT: "bg-surface-2 text-ink-secondary",
    ACTIVE: "bg-green-50 text-green-700",
    PAUSED: "bg-amber-50 text-amber-700",
    CHURNED: "bg-red-50 text-red-600",
  };
  const labels = {
    PROSPECT: "Prospect",
    ACTIVE: "Active",
    PAUSED: "Paused",
    CHURNED: "Churned",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PREPARATION: "bg-blue-50 text-blue-700",
    ACTIVE: "bg-green-50 text-green-700",
    PAUSED: "bg-amber-50 text-amber-700",
    COMPLETED: "bg-surface-2 text-ink-secondary",
  };
  const labels: Record<string, string> = {
    PREPARATION: "Preparation",
    ACTIVE: "Active",
    PAUSED: "Paused",
    COMPLETED: "Completed",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status] ?? "bg-surface-2 text-ink-secondary"
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}

function ContractSummary({ contract }: { contract: { title: string; status: string; signedAt: Date | null; value: unknown } }) {
  const statusStyles: Record<string, string> = {
    DRAFT: "text-ink-muted",
    SENT: "text-amber-700",
    SIGNED: "text-green-700",
    EXPIRED: "text-red-600",
    TERMINATED: "text-red-600",
  };
  return (
    <div className="text-sm space-y-1">
      <p className="font-medium text-ink-primary truncate">{contract.title}</p>
      <p className={cn("capitalize", statusStyles[contract.status])}>
        {contract.status.toLowerCase()}
      </p>
      {contract.signedAt && (
        <p className="text-ink-muted">Signed {formatDate(contract.signedAt)}</p>
      )}
    </div>
  );
}
