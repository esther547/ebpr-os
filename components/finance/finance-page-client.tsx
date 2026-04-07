"use client";

import { useState } from "react";
import { cn, formatDate, formatCurrency, INVOICE_STATUS_COLORS, PAYMENT_METHOD_LABELS } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { CreateInvoiceModal } from "./create-invoice-modal";
import { RecordPaymentModal } from "./record-payment-modal";
import { useRouter } from "next/navigation";
import { DollarSign, FileText, CreditCard, AlertTriangle } from "lucide-react";

type PaymentRow = {
  id: string;
  amount: unknown;
  paidAt: string | Date;
  method: string;
  reference: string | null;
  notes: string | null;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: unknown;
  issuedAt: string | Date | null;
  dueDate: string | Date | null;
  paidAt: string | Date | null;
  client: { id: string; name: string };
  contract: { id: string; title: string } | null;
  payments: PaymentRow[];
};

type ContractRow = {
  id: string;
  title: string;
  status: string;
  value: unknown;
  billingReady: boolean;
  client: { id: string; name: string };
};

type Tab = "invoices" | "payments" | "contracts";

interface Props {
  invoices: InvoiceRow[];
  contracts: ContractRow[];
  clients: { id: string; name: string }[];
  allContracts: { id: string; title: string; clientId: string }[];
  canManage: boolean;
}

export function FinancePageClient({ invoices, contracts, clients, allContracts, canManage }: Props) {
  const [tab, setTab] = useState<Tab>("invoices");
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [payInvoice, setPayInvoice] = useState<InvoiceRow | null>(null);
  const router = useRouter();

  // Stats
  const totalOutstanding = invoices
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const totalReceived = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;
  const allPayments = invoices.flatMap((i) =>
    i.payments.map((p) => ({ ...p, invoiceNumber: i.invoiceNumber, clientName: i.client.name }))
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "invoices", label: "Invoices" },
    { key: "payments", label: "Payments" },
    { key: "contracts", label: "Contracts" },
  ];

  async function markStatus(invoiceId: string, status: string) {
    await fetch(`/api/invoices/${invoiceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-ink-muted" />
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Total Invoices</span>
          </div>
          <p className="text-2xl font-bold text-ink-primary">{invoices.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Outstanding</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Received</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t.key
                ? "border-ink-primary text-ink-primary"
                : "border-transparent text-ink-muted hover:text-ink-secondary"
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        {canManage && tab === "invoices" && (
          <Button onClick={() => setShowCreateInvoice(true)} size="sm">
            + New Invoice
          </Button>
        )}
      </div>

      {/* Invoices Tab */}
      {tab === "invoices" && (
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-1">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Invoice #</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Client</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Due Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Paid</th>
                {canManage && <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-surface-1 transition-colors">
                  <td className="px-5 py-4 font-medium text-ink-primary">{inv.invoiceNumber}</td>
                  <td className="px-5 py-4 text-ink-secondary">{inv.client.name}</td>
                  <td className="px-5 py-4 font-medium text-ink-primary">{formatCurrency(inv.amount as number)}</td>
                  <td className="px-5 py-4">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", INVOICE_STATUS_COLORS[inv.status as keyof typeof INVOICE_STATUS_COLORS] || "bg-surface-2 text-ink-secondary")}>
                      {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-secondary">{formatDate(inv.dueDate)}</td>
                  <td className="px-5 py-4 text-ink-secondary">{formatDate(inv.paidAt)}</td>
                  {canManage && (
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {inv.status === "DRAFT" && (
                          <button onClick={() => markStatus(inv.id, "SENT")} className="text-xs text-blue-600 hover:underline">
                            Mark Sent
                          </button>
                        )}
                        {(inv.status === "SENT" || inv.status === "OVERDUE") && (
                          <button onClick={() => setPayInvoice(inv)} className="text-xs text-green-600 hover:underline">
                            Record Payment
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="px-5 py-12 text-center text-ink-muted">
                    No invoices yet. Create the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Payments Tab */}
      {tab === "payments" && (
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-1">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Invoice</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Client</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Method</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allPayments
                .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
                .map((p) => (
                  <tr key={p.id} className="hover:bg-surface-1 transition-colors">
                    <td className="px-5 py-4 text-ink-secondary">{formatDate(p.paidAt)}</td>
                    <td className="px-5 py-4 font-medium text-ink-primary">{p.invoiceNumber}</td>
                    <td className="px-5 py-4 text-ink-secondary">{p.clientName}</td>
                    <td className="px-5 py-4 font-medium text-green-700">{formatCurrency(p.amount as number)}</td>
                    <td className="px-5 py-4 text-ink-secondary">{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] || p.method}</td>
                    <td className="px-5 py-4 text-ink-muted">{p.reference || "—"}</td>
                  </tr>
                ))}
              {allPayments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-ink-muted">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Contracts Tab */}
      {tab === "contracts" && (
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-1">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Contract</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Client</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Value</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Billing Ready</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-surface-1 transition-colors">
                  <td className="px-5 py-4 font-medium text-ink-primary">{c.title}</td>
                  <td className="px-5 py-4 text-ink-secondary">{c.client.name}</td>
                  <td className="px-5 py-4 font-medium text-ink-primary">{formatCurrency(c.value as number)}</td>
                  <td className="px-5 py-4">
                    {c.billingReady ? (
                      <span className="text-green-700 font-medium">Ready</span>
                    ) : (
                      <span className="text-ink-muted">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-ink-muted">
                    No signed contracts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <CreateInvoiceModal
        open={showCreateInvoice}
        onOpenChange={setShowCreateInvoice}
        clients={clients}
        contracts={allContracts}
      />

      {payInvoice && (
        <RecordPaymentModal
          open={!!payInvoice}
          onOpenChange={(open) => { if (!open) setPayInvoice(null); }}
          invoice={payInvoice}
        />
      )}
    </>
  );
}
