import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { AlertTriangle, FileText, Clock } from "lucide-react";

export const metadata = { title: "Overdue Follow-Ups — EBPR" };
export const dynamic = "force-dynamic";

export default async function AssistantPortalPage() {
  const user = await requireUser();
  const now = new Date();

  // ── 1. Overdue Invoices (1+ day past due) — client names only ──
  const overdueInvoices = await db.invoice.findMany({
    where: {
      OR: [
        { status: "OVERDUE" },
        {
          status: "SENT",
          dueDate: { lt: now },
        },
      ],
    },
    select: {
      id: true,
      dueDate: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  // Deduplicate by client, keep the oldest due date
  const overdueByClient = new Map<string, { name: string; daysOverdue: number }>();
  for (const inv of overdueInvoices) {
    if (!overdueByClient.has(inv.client.id) && inv.dueDate) {
      const days = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      overdueByClient.set(inv.client.id, { name: inv.client.name, daysOverdue: days });
    }
  }
  const overdueClients = Array.from(overdueByClient.values()).sort((a, b) => b.daysOverdue - a.daysOverdue);

  // ── 2. Unsigned/Pending Contracts — client names only ──
  const unsignedContracts = await db.contract.findMany({
    where: {
      status: { in: ["DRAFT", "SENT"] },
    },
    select: {
      id: true,
      status: true,
      sentAt: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Deduplicate by client
  const unsignedByClient = new Map<string, { name: string; status: string; daysPending: number }>();
  for (const c of unsignedContracts) {
    if (!unsignedByClient.has(c.client.id)) {
      const sentDate = c.sentAt || new Date();
      const days = Math.floor((now.getTime() - new Date(sentDate).getTime()) / (1000 * 60 * 60 * 24));
      unsignedByClient.set(c.client.id, {
        name: c.client.name,
        status: c.status,
        daysPending: days,
      });
    }
  }
  const unsignedClients = Array.from(unsignedByClient.values()).sort((a, b) => b.daysPending - a.daysPending);

  const totalIssues = overdueClients.length + unsignedClients.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-primary">Overdue Follow-Ups</h1>
        <p className="text-sm text-ink-muted mt-1">
          Welcome, {user.name} · {totalIssues} item{totalIssues !== 1 ? "s" : ""} need attention
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Overdue Payments</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{overdueClients.length}</p>
          <p className="text-xs text-ink-muted mt-1">clients with outstanding balances</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Pending Signatures</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{unsignedClients.length}</p>
          <p className="text-xs text-ink-muted mt-1">contracts awaiting signature</p>
        </div>
      </div>

      {/* Overdue Payments */}
      <section className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Overdue Payments — Follow Up Immediately
        </h2>

        {overdueClients.length > 0 ? (
          <div className="rounded-lg border border-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-1">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Client</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Days Overdue</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overdueClients.map((client, i) => (
                  <tr key={i} className="hover:bg-surface-1 transition-colors border-l-4 border-l-red-500">
                    <td className="px-5 py-4 font-medium text-ink-primary">{client.name}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                        {client.daysOverdue} day{client.daysOverdue !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {client.daysOverdue >= 7 ? (
                        <span className="text-xs font-bold text-red-600">URGENT</span>
                      ) : client.daysOverdue >= 3 ? (
                        <span className="text-xs font-semibold text-amber-600">HIGH</span>
                      ) : (
                        <span className="text-xs font-medium text-ink-secondary">NORMAL</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <p className="text-sm text-ink-muted">No overdue payments. All caught up! ✅</p>
          </div>
        )}
      </section>

      {/* Unsigned Contracts */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Pending Contract Signatures — Follow Up
        </h2>

        {unsignedClients.length > 0 ? (
          <div className="rounded-lg border border-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-1">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Client</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Days Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unsignedClients.map((client, i) => (
                  <tr key={i} className="hover:bg-surface-1 transition-colors border-l-4 border-l-amber-500">
                    <td className="px-5 py-4 font-medium text-ink-primary">{client.name}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        client.status === "SENT" ? "bg-amber-50 text-amber-700" : "bg-surface-2 text-ink-secondary"
                      }`}>
                        {client.status === "SENT" ? "Awaiting Signature" : "Draft"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink-secondary">
                      {client.daysPending > 0 ? `${client.daysPending} day${client.daysPending !== 1 ? "s" : ""}` : "Today"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <p className="text-sm text-ink-muted">No pending signatures. ✅</p>
          </div>
        )}
      </section>
    </div>
  );
}
