import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { FollowUpClient } from "@/components/follow-up/follow-up-client";

export const metadata = { title: "Follow-Up Payments & Contracts" };
export const dynamic = "force-dynamic";

export default async function FollowUpPage() {
  const user = await requireUser();

  const allowed = ["SUPER_ADMIN", "ASSISTANT", "FINANCE", "LEGAL"];
  if (!allowed.includes(user.role)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const now = new Date();

  // Overdue invoices with IDs for editing
  const overdueInvoices = await db.invoice.findMany({
    where: {
      OR: [
        { status: "OVERDUE" },
        { status: "SENT", dueDate: { lt: now } },
      ],
    },
    select: {
      id: true,
      invoiceNumber: true,
      dueDate: true,
      notes: true,
      status: true,
      amount: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  // Unsigned contracts with IDs for editing
  const unsignedContracts = await db.contract.findMany({
    where: { status: { in: ["DRAFT", "SENT"] } },
    select: {
      id: true,
      status: true,
      sentAt: true,
      notes: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const canEdit = user.role === "SUPER_ADMIN" || user.role === "ASSISTANT" || user.role === "FINANCE" || user.role === "LEGAL";

  return (
    <>
      <PageHeader
        title="Follow-Up Payments & Contracts"
        subtitle={`${overdueInvoices.length + unsignedContracts.length} items need attention`}
      />
      <FollowUpClient
        overdueInvoices={JSON.parse(JSON.stringify(overdueInvoices))}
        unsignedContracts={JSON.parse(JSON.stringify(unsignedContracts))}
        canEdit={canEdit}
      />
    </>
  );
}
