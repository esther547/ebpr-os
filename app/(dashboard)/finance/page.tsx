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

  // Fetch clients with their contracts, invoices, and billing contacts
  const clientsWithData = await db.client.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: {
      contracts: {
        orderBy: { createdAt: "desc" },
        take: 1, // latest contract per client
        select: {
          id: true,
          title: true,
          status: true,
          startDate: true,
          endDate: true,
          value: true,
          notes: true,
        },
      },
      invoices: {
        orderBy: [{ dueDate: "asc" }],
        include: { payments: true },
      },
      contacts: {
        where: { role: "Billing" },
        select: { name: true, email: true },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Accounting — Active Clients"
      />
      <FinancePageClient
        clients={JSON.parse(JSON.stringify(clientsWithData))}
        canManage={canManageFinance(user)}
      />
    </>
  );
}
