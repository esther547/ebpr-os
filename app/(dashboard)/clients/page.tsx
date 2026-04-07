import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canViewClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { ClientCard } from "@/components/clients/client-card";
import { ClientStatus } from "@prisma/client";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const user = await requireUser();
  if (!canViewClients(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const clients = await db.client.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      onboarding: { select: { status: true } },
      _count: {
        select: {
          deliverables: true,
          campaigns: true,
          contracts: true,
        },
      },
    },
  });

  const activeClients = clients.filter((c) => c.status === ClientStatus.ACTIVE);
  const prospectClients = clients.filter((c) => c.status === ClientStatus.PROSPECT);
  const otherClients = clients.filter(
    (c) =>
      c.status !== ClientStatus.ACTIVE && c.status !== ClientStatus.PROSPECT
  );

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${activeClients.length} active · ${prospectClients.length} prospects`}
        actions={
          <Link
            href="/clients/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-ink-primary px-4 text-sm font-medium text-ink-inverted hover:bg-ink-primary/90 transition-colors"
          >
            + New Client
          </Link>
        }
      />

      {/* Active clients */}
      {activeClients.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Active
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeClients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        </section>
      )}

      {/* Prospects */}
      {prospectClients.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Prospects
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {prospectClients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        </section>
      )}

      {/* Other (paused, churned) */}
      {otherClients.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Inactive
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherClients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        </section>
      )}

      {clients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-lg font-medium text-ink-primary">No clients yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Add your first client to get started.
          </p>
          <Link
            href="/clients/new"
            className="mt-6 inline-flex h-9 items-center rounded-md bg-ink-primary px-4 text-sm font-medium text-ink-inverted hover:bg-ink-primary/90"
          >
            Add Client
          </Link>
        </div>
      )}
    </>
  );
}
