import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canViewClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientsDirectory } from "@/components/clients/clients-directory";
import { ClientStatus } from "@prisma/client";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const user = await requireUser();
  if (!canViewClients(user)) {
    return (
      <EmptyState
        className="mt-10"
        title="Access restricted"
        description="You do not have permission to view clients."
      />
    );
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

  const cards = clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status as string,
    industry: c.industry,
    onboardingStatus: c.onboarding?.status ?? null,
    counts: {
      deliverables: c._count.deliverables,
      campaigns: c._count.campaigns,
      contracts: c._count.contracts,
    },
  }));

  return (
    <>
      <PageHeader
        eyebrow="Roster"
        title="Clients"
        subtitle={`${activeClients.length} active · ${prospectClients.length} prospects`}
        actions={
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="h-4 w-4" />
              New Client
            </Link>
          </Button>
        }
      />

      <ClientsDirectory clients={cards} />
    </>
  );
}
