import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysSince, overdueInvoiceWhere } from "@/components/finance/invoice-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, Th, Td, TableEmpty } from "@/components/ui/table";
import { AlertTriangle, FileText } from "lucide-react";

export const metadata = { title: "Overdue Follow-Ups — EBPR" };
export const dynamic = "force-dynamic";

export default async function AssistantPortalPage() {
  const user = await requireUser();
  const now = new Date();

  // ── 1. Overdue Invoices (1+ day past due, not PAID/CANCELLED) — client names only ──
  const overdueInvoices = await db.invoice.findMany({
    where: overdueInvoiceWhere(now),
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
    if (!overdueByClient.has(inv.client.id)) {
      overdueByClient.set(inv.client.id, { name: inv.client.name, daysOverdue: daysSince(inv.dueDate, now) });
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
      createdAt: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Deduplicate by client
  const unsignedByClient = new Map<string, { name: string; status: string; daysPending: number }>();
  for (const c of unsignedContracts) {
    if (!unsignedByClient.has(c.client.id)) {
      // Drafts have no sentAt: count from creation so they don't all read "Today".
      unsignedByClient.set(c.client.id, {
        name: c.client.name,
        status: c.status,
        daysPending: daysSince(c.sentAt ?? c.createdAt, now),
      });
    }
  }
  const unsignedClients = Array.from(unsignedByClient.values()).sort((a, b) => b.daysPending - a.daysPending);

  const totalIssues = overdueClients.length + unsignedClients.length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-secondary">
        Welcome, {user.name} · {totalIssues} item{totalIssues !== 1 ? "s" : ""} need attention
      </p>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Overdue Payments"
          value={overdueClients.length}
          tone={overdueClients.length > 0 ? "danger" : "neutral"}
          icon={<AlertTriangle />}
          hint="clients with outstanding balances"
        />
        <StatTile
          label="Pending Signatures"
          value={unsignedClients.length}
          tone={unsignedClients.length > 0 ? "warning" : "neutral"}
          icon={<FileText />}
          hint="contracts awaiting signature"
        />
      </div>

      {/* Overdue Payments */}
      <Card padding="none" className="overflow-hidden">
        <CardHeader
          className="mb-0 border-b border-border px-5 py-4"
          eyebrow="Follow up immediately"
          title="Overdue payments"
          description="Clients with an invoice past its due date"
        />
        <div className="overflow-x-auto">
          <Table className="min-w-[460px]">
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Days overdue</Th>
                <Th>Priority</Th>
              </tr>
            </thead>
            <tbody>
              {overdueClients.length === 0 ? (
                <TableEmpty colSpan={3}>No overdue payments. All caught up.</TableEmpty>
              ) : (
                overdueClients.map((client, i) => (
                  <tr key={i}>
                    <Td className="font-medium text-ink-primary">{client.name}</Td>
                    <Td>
                      <Badge tone="danger" size="xs">
                        {client.daysOverdue} day{client.daysOverdue !== 1 ? "s" : ""}
                      </Badge>
                    </Td>
                    <Td>
                      {client.daysOverdue >= 7 ? (
                        <Badge tone="danger" size="xs">Urgent</Badge>
                      ) : client.daysOverdue >= 3 ? (
                        <Badge tone="warning" size="xs">High</Badge>
                      ) : (
                        <Badge tone="neutral" size="xs">Normal</Badge>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      {/* Unsigned Contracts */}
      <Card padding="none" className="overflow-hidden">
        <CardHeader
          className="mb-0 border-b border-border px-5 py-4"
          eyebrow="Follow up"
          title="Pending contract signatures"
          description="Contracts still in draft or awaiting a signature"
        />
        <div className="overflow-x-auto">
          <Table className="min-w-[460px]">
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Status</Th>
                <Th>Days pending</Th>
              </tr>
            </thead>
            <tbody>
              {unsignedClients.length === 0 ? (
                <TableEmpty colSpan={3}>No pending signatures.</TableEmpty>
              ) : (
                unsignedClients.map((client, i) => (
                  <tr key={i}>
                    <Td className="font-medium text-ink-primary">{client.name}</Td>
                    <Td>
                      <Badge tone={client.status === "SENT" ? "warning" : "neutral"} size="xs">
                        {client.status === "SENT" ? "Awaiting signature" : "Draft"}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap tabular text-ink-secondary">
                      {client.daysPending > 0 ? `${client.daysPending} day${client.daysPending !== 1 ? "s" : ""}` : "Today"}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
