import { redirect } from "next/navigation";
import { FEATURES } from "@/lib/features";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysSince } from "@/lib/form-helpers";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, Th, Td, TableEmpty } from "@/components/ui/table";
import { FileText } from "lucide-react";

export const metadata = { title: "Follow-Ups — EBPR" };
export const dynamic = "force-dynamic";

export default async function AssistantPortalPage() {
  if (!FEATURES.legal) redirect("/paused");
  const user = await requireUser();
  const now = new Date();

  // ── Unsigned/Pending Contracts — client names only ──
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

  const totalIssues = unsignedClients.length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-secondary">
        Welcome, {user.name} · {totalIssues} item{totalIssues !== 1 ? "s" : ""} need attention
      </p>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Pending Signatures"
          value={unsignedClients.length}
          tone={unsignedClients.length > 0 ? "warning" : "neutral"}
          icon={<FileText />}
          hint="contracts awaiting signature"
        />
      </div>

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
