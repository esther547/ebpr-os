import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AlertTriangle, FileText } from "lucide-react";

export const metadata = { title: "Follow-Ups — EBPR" };
export const dynamic = "force-dynamic";

export default async function AssistantPortalPage() {
  const user = await requireUser();

  // Get clients with overdue invoices (1+ days past due) — client names only
  const overdueInvoices = await db.invoice.findMany({
    where: {
      status: { in: ["SENT", "OVERDUE"] },
      dueDate: { lt: new Date() },
    },
    select: {
      clientId: true,
      client: { select: { name: true } },
    },
  });

  // Deduplicate by client — just show each client once
  const overdueClientNames = [...new Set(overdueInvoices.map((i) => i.client.name))].sort();

  // Get clients with unsigned contracts (NOT SIGNED) — client names only
  const unsignedContracts = await db.contract.findMany({
    where: {
      status: { in: ["DRAFT", "SENT"] },
    },
    select: {
      clientId: true,
      client: { select: { name: true } },
    },
  });

  // Deduplicate by client
  const unsignedClientNames = [...new Set(unsignedContracts.map((c) => c.client.name))].sort();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-ink-primary">Follow-Ups</h1>
        <p className="text-sm text-ink-muted mt-1">
          Welcome, {user.name} · Payment & contract follow-ups
        </p>
      </div>

      {/* Overdue Payments — Client Names Only */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Outstanding Payments ({overdueClientNames.length} client{overdueClientNames.length !== 1 ? "s" : ""})
          </h2>
        </div>

        {overdueClientNames.length > 0 ? (
          <div className="rounded-lg border border-border bg-white overflow-hidden">
            <ul className="divide-y divide-border">
              {overdueClientNames.map((name) => (
                <li key={name} className="px-5 py-4 flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="font-medium text-ink-primary">{name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <p className="text-sm text-ink-muted">No outstanding payments. All caught up!</p>
          </div>
        )}
      </section>

      {/* Unsigned Contracts — Client Names Only */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-amber-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Pending Signatures ({unsignedClientNames.length} client{unsignedClientNames.length !== 1 ? "s" : ""})
          </h2>
        </div>

        {unsignedClientNames.length > 0 ? (
          <div className="rounded-lg border border-border bg-white overflow-hidden">
            <ul className="divide-y divide-border">
              {unsignedClientNames.map((name) => (
                <li key={name} className="px-5 py-4 flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="font-medium text-ink-primary">{name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <p className="text-sm text-ink-muted">No pending signatures.</p>
          </div>
        )}
      </section>
    </div>
  );
}
