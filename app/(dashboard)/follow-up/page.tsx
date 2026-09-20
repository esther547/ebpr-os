import { requireUser } from "@/lib/auth";
import { canViewFollowUp } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { FollowUpClient } from "@/components/follow-up/follow-up-client";
import { overdueInvoiceWhere } from "@/components/finance/invoice-status";

export const metadata = { title: "Follow-Up Payments & Contracts" };
export const dynamic = "force-dynamic";

export default async function FollowUpPage() {
  const user = await requireUser();

  if (!canViewFollowUp(user)) {
    return <p className="py-16 text-center text-sm text-ink-muted">Access restricted.</p>;
  }

  const now = new Date();

  // Invoices 1+ day overdue (any status except PAID/CANCELLED). Amounts are never
  // selected here: this page is client-names-only for every role.
  const [overdueInvoices, unsignedContracts] = await Promise.all([
    db.invoice.findMany({
      where: overdueInvoiceWhere(now),
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        notes: true,
        status: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    db.contract.findMany({
      where: { status: { in: ["DRAFT", "SENT"] } },
      select: {
        id: true,
        status: true,
        sentAt: true,
        createdAt: true,
        notes: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Collections"
        title="Follow-Up"
        subtitle={`${overdueInvoices.length + unsignedContracts.length} item${overdueInvoices.length + unsignedContracts.length !== 1 ? "s" : ""} need attention across payments and contracts`}
      />
      <FollowUpClient
        overdueInvoices={JSON.parse(JSON.stringify(overdueInvoices))}
        unsignedContracts={JSON.parse(JSON.stringify(unsignedContracts))}
        canEdit={true}
      />
    </>
  );
}
