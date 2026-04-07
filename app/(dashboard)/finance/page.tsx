import { requireUser } from "@/lib/auth";
import { canViewFinance, canManageFinance } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { FinancePageClient } from "@/components/finance/finance-page-client";

export const metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const user = await requireUser();
  if (!canViewFinance(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const invoices = await db.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      contract: { select: { id: true, title: true } },
      payments: true,
    },
  });

  const contracts = await db.contract.findMany({
    where: { status: "SIGNED" },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const allContracts = await db.contract.findMany({
    select: { id: true, title: true, clientId: true },
    orderBy: { title: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Invoicing & payments"
      />
      <FinancePageClient
        invoices={JSON.parse(JSON.stringify(invoices))}
        contracts={JSON.parse(JSON.stringify(contracts))}
        clients={clients}
        allContracts={allContracts}
        canManage={canManageFinance(user)}
      />
    </>
  );
}
