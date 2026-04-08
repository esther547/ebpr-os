import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { AlertTriangle, FileText } from "lucide-react";

export const metadata = { title: "Follow-Ups — EBPR" };
export const dynamic = "force-dynamic";

export default async function AssistantPortalPage() {
  const user = await requireUser();

  // Get overdue invoices — show client name only, no dollar amounts
  const overdueInvoices = await db.invoice.findMany({
    where: {
      status: { in: ["SENT", "OVERDUE"] },
      dueDate: { lt: new Date() },
    },
    select: {
      id: true,
      invoiceNumber: true,
      dueDate: true,
      client: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  // Get unsigned contracts — pending signature
  const unsignedContracts = await db.contract.findMany({
    where: {
      status: { in: ["DRAFT", "SENT"] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      sentAt: true,
      client: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-ink-primary">Follow-Ups</h1>
        <p className="text-sm text-ink-muted mt-1">
          Welcome, {user.name} · Payment & contract follow-ups
        </p>
      </div>

      {/* Overdue Payments */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Overdue Payments ({overdueInvoices.length})
          </h2>
        </div>

        {overdueInvoices.length > 0 ? (
          <div className="rounded-lg border border-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-1">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Client</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Invoice</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Due Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Days Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overdueInvoices.map((inv) => {
                  const daysOverdue = Math.floor(
                    (now.getTime() - new Date(inv.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr key={inv.id} className="hover:bg-surface-1 transition-colors">
                      <td className="px-5 py-4 font-medium text-ink-primary">{inv.client.name}</td>
                      <td className="px-5 py-4 text-ink-secondary">{inv.invoiceNumber}</td>
                      <td className="px-5 py-4 text-ink-secondary">{formatDate(inv.dueDate)}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                          {daysOverdue} day{daysOverdue !== 1 ? "s" : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <p className="text-sm text-ink-muted">No overdue payments. All caught up!</p>
          </div>
        )}
      </section>

      {/* Unsigned Contracts */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-amber-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Pending Contracts ({unsignedContracts.length})
          </h2>
        </div>

        {unsignedContracts.length > 0 ? (
          <div className="rounded-lg border border-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-1">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Client</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Contract</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unsignedContracts.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-1 transition-colors">
                    <td className="px-5 py-4 font-medium text-ink-primary">{c.client.name}</td>
                    <td className="px-5 py-4 text-ink-secondary">{c.title}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === "SENT" ? "bg-amber-50 text-amber-700" : "bg-surface-2 text-ink-secondary"}`}>
                        {c.status === "SENT" ? "Awaiting Signature" : "Draft"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink-secondary">{formatDate(c.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <p className="text-sm text-ink-muted">No pending contracts.</p>
          </div>
        )}
      </section>
    </div>
  );
}
