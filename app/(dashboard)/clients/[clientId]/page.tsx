import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { DeliverablePacingBar } from "@/components/deliverables/pacing-bar";
import { formatDate } from "@/lib/utils";
import { currentCycle, cycleLabel } from "@/lib/cycles";
import { ClientHeader } from "@/components/clients/client-header";
import { availabilityNowFor, toWindow } from "@/lib/client-availability";
import { ClientAvailability } from "@/components/clients/client-availability";
import { dayKeyInTz } from "@/components/runners/miami-time";
import { ClientReminders } from "@/components/clients/client-reminders";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/form-field";

type Props = { params: { clientId: string } };

export async function generateMetadata({ params }: Props) {
  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { name: true },
  });
  return { title: client?.name ?? "Client" };
}

export default async function ClientPage({ params }: Props) {
  await requireUser();

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
  const availabilityNow = await availabilityNowFor(client.id);

  const cycle = currentCycle(client.cycleDay);
  const { month, year } = cycle;

  // Cycle deliverable pacing
  const deliverables = await db.deliverable.findMany({
    where: { clientId: params.clientId, month, year },
    select: { status: true },
  });

  const completed = deliverables.filter((d) => d.status === "COMPLETED").length;
  const inProgress = deliverables.filter(
    (d) => !["COMPLETED", "CANCELLED", "IDEA"].includes(d.status)
  ).length;

  // Reminders
  const reminders = await db.reminder.findMany({
    where: { clientId: params.clientId, isDone: false },
    orderBy: { remindAt: "asc" },
    include: { createdBy: { select: { name: true } } },
  });

  // Availability / travel windows (all; the card splits current+upcoming vs past)
  const availabilityRows = await db.clientAvailability.findMany({
    where: { clientId: params.clientId },
    orderBy: { startDate: "asc" },
  });

  // Recent activity
  const activity = await db.activityLog.findMany({
    where: { clientId: params.clientId },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });

  return (
    <>
      <ClientHeader availabilityNow={availabilityNow}
        client={client}
        counts={{ deliverables: client._count.deliverables, strategy: client._count.strategyItems, files: client._count.files }}
        actions={
          <Button asChild>
            <Link href={`/clients/${client.id}/deliverables`}>
              <Plus className="h-4 w-4" />
              Deliverable
            </Link>
          </Button>
        }
      />

      <div id="overview" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Monthly Pacing */}
          <Card padding="lg">
            <CardHeader
              eyebrow="Pacing"
              title={cycleLabel(cycle, client.cycleDay)}
              description={`Target: ${client.monthlyTarget} deliverables`}
            />
            <DeliverablePacingBar
              completed={completed}
              inProgress={inProgress}
              target={client.monthlyTarget}
            />
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
              <span>
                <span className="tabular font-semibold text-ink-primary">{completed}</span> completed
              </span>
              <span>
                <span className="tabular font-semibold text-ink-primary">{inProgress}</span> in progress
              </span>
              <span>
                <span className="tabular font-semibold text-ink-primary">{deliverables.length}</span> total this cycle
              </span>
            </div>
          </Card>

          <ClientAvailability
            clientId={client.id}
            windows={availabilityRows.map(toWindow)}
            todayKey={dayKeyInTz(new Date())}
          />

          {/* Active Campaigns */}
          {client.campaigns.length > 0 && (
            <Card padding="lg">
              <CardHeader
                title="Active Campaigns"
                actions={
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/clients/${client.id}/campaigns`}>
                      View all
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                }
              />
              <div className="space-y-2">
                {client.campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/clients/${client.id}/campaigns`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-1"
                  >
                    <span className="truncate text-sm font-medium text-ink-primary">{campaign.name}</span>
                    <Badge tone={statusTone(campaign.status)}>{humanize(campaign.status)}</Badge>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Recent Activity */}
          <Card padding="lg">
            <CardHeader title="Recent Activity" />
            <ActivityTimeline entries={JSON.parse(JSON.stringify(activity))} />
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card padding="lg">
            <CardHeader title="Client Info" />
            <dl className="space-y-3 text-sm">
              {client.website && (
                <div>
                  <dt className="eyebrow">Website</dt>
                  <dd className="mt-0.5 truncate font-medium text-ink-primary">{client.website}</dd>
                </div>
              )}
              <div>
                <dt className="eyebrow">Monthly Target</dt>
                <dd className="mt-0.5 font-medium text-ink-primary">
                  <span className="tabular">{client.monthlyTarget}</span> deliverables
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Strategy Items</dt>
                <dd className="tabular mt-0.5 font-medium text-ink-primary">{client._count.strategyItems}</dd>
              </div>
              <div>
                <dt className="eyebrow">Files</dt>
                <dd className="tabular mt-0.5 font-medium text-ink-primary">{client._count.files}</dd>
              </div>
            </dl>
          </Card>

          <ClientReminders clientId={client.id} reminders={JSON.parse(JSON.stringify(reminders))} />

          {client.contacts.length > 0 && (
            <Card padding="lg">
              <CardHeader title="Contacts" />
              <ul className="space-y-3">
                {client.contacts.slice(0, 4).map((contact) => (
                  <li key={contact.id} className="text-sm">
                    <p className="font-medium text-ink-primary">{contact.name}</p>
                    {contact.role && <p className="text-xs text-ink-muted">{contact.role}</p>}
                    {contact.email && <p className="truncate text-xs text-ink-muted">{contact.email}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {FEATURES.legal && client.contracts[0] && (
            <Card padding="lg">
              <CardHeader
                title="Contract"
                actions={
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/legal">
                      All
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                }
              />
              <div className="space-y-2 text-sm">
                <p className="truncate font-medium text-ink-primary">{client.contracts[0].title}</p>
                <Badge tone={statusTone(client.contracts[0].status)}>
                  {humanize(client.contracts[0].status)}
                </Badge>
                {client.contracts[0].signedAt && (
                  <p className="text-xs text-ink-muted">Signed {formatDate(client.contracts[0].signedAt)}</p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
