import { requireUser } from "@/lib/auth";
import { canViewContracts } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { LegalPageClient } from "@/components/legal/legal-page-client";

export const metadata = { title: "Legal & Contracts" };
export const dynamic = "force-dynamic";

export default async function LegalPage() {
  const user = await requireUser();
  if (!canViewContracts(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const contracts = await db.contract.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Legal & Contracts"
        subtitle={`${contracts.length} contracts · ${contracts.filter((c) => c.status === "DRAFT" || c.status === "SENT").length} need action`}
      />
      <LegalPageClient
        contracts={JSON.parse(JSON.stringify(contracts))}
        clients={clients}
      />
    </>
  );
}
