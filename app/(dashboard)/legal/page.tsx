import { requireUser } from "@/lib/auth";
import { canViewContracts } from "@/lib/permissions";
import { db } from "@/lib/db";
import { LegalPageClient } from "@/components/legal/legal-page-client";

export const metadata = { title: "Legal & Contracts" };
export const dynamic = "force-dynamic";

export default async function LegalPage() {
  const user = await requireUser();
  if (!canViewContracts(user)) {
    return <p className="py-16 text-center text-sm text-ink-muted">Access restricted.</p>;
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
    <LegalPageClient
      contracts={JSON.parse(JSON.stringify(contracts))}
      clients={clients}
    />
  );
}
