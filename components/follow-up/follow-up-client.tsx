"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Check, MessageSquare, X } from "lucide-react";
import { apiErrorMessage, daysSince, localDateInputValue } from "@/components/finance/invoice-status";

// Client names only — this component never receives or shows amounts.
type OverdueInvoice = {
  id: string;
  invoiceNumber: string;
  dueDate: string | Date | null;
  notes: string | null;
  status: string;
  client: { id: string; name: string };
};

type UnsignedContract = {
  id: string;
  status: string;
  sentAt: string | Date | null;
  createdAt: string | Date;
  notes: string | null;
  client: { id: string; name: string };
};

interface Props {
  overdueInvoices: OverdueInvoice[];
  unsignedContracts: UnsignedContract[];
  canEdit: boolean;
}

function priorityLabel(days: number) {
  if (days >= 7) return <span className="text-xs font-bold text-red-600">URGENT</span>;
  if (days >= 3) return <span className="text-xs font-semibold text-amber-600">HIGH</span>;
  return <span className="text-xs font-medium text-ink-secondary">NORMAL</span>;
}

// ─── Editable Note Cell ──────────────────────────────────

function EditableNote({ value, onSave, placeholder }: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div
        className="cursor-pointer hover:bg-surface-1 rounded px-2 py-1 -mx-1 min-h-[28px] flex items-center gap-1 group"
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {value ? (
          <span className="text-sm text-ink-secondary">{value}</span>
        ) : (
          <span className="text-sm text-ink-muted flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> {placeholder || "Add note..."}
          </span>
        )}
      </div>
    );
  }

  return (
    <textarea
      className="w-full rounded border border-border bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ink-primary resize-none"
      value={draft}
      rows={2}
      autoFocus
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft); }}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } if (e.key === "Escape") setEditing(false); }}
    />
  );
}

// ─── Main Component ──────────────────────────────────────

export function FollowUpClient({ overdueInvoices, unsignedContracts, canEdit }: Props) {
  const router = useRouter();
  const [marking, setMarking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PUT helper: surfaces API errors instead of silently refreshing.
  const update = useCallback(async (url: string, body: Record<string, unknown>, fallback: string) => {
    setError(null);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(apiErrorMessage(data, fallback));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(fallback);
      return false;
    }
  }, [router]);

  const saveInvoiceNotes = useCallback((invoiceId: string, notes: string) =>
    update(`/api/invoices/${invoiceId}`, { notes: notes || null }, "Failed to save note"), [update]);

  const saveContractNotes = useCallback((contractId: string, notes: string) =>
    update(`/api/contracts/${contractId}`, { notes: notes || null }, "Failed to save note"), [update]);

  const markInvoicePaid = useCallback(async (invoiceId: string) => {
    setMarking(invoiceId);
    // Send the user's calendar date (YYYY-MM-DD), not a timestamp, so the paid date never shifts.
    await update(`/api/invoices/${invoiceId}`, { status: "PAID", paidAt: localDateInputValue() }, "Failed to mark paid");
    setMarking(null);
  }, [update]);

  const markContractSigned = useCallback(async (contractId: string) => {
    setMarking(contractId);
    await update(`/api/contracts/${contractId}`, { status: "SIGNED" }, "Failed to mark signed");
    setMarking(null);
  }, [update]);

  // Deduplicate overdue by client (group invoices)
  const overdueByClient = new Map<string, { name: string; invoices: OverdueInvoice[] }>();
  for (const inv of overdueInvoices) {
    const existing = overdueByClient.get(inv.client.id);
    if (existing) {
      existing.invoices.push(inv);
    } else {
      overdueByClient.set(inv.client.id, { name: inv.client.name, invoices: [inv] });
    }
  }
  const overdueClients = Array.from(overdueByClient.values());

  // Deduplicate contracts by client
  const contractsByClient = new Map<string, { name: string; contracts: UnsignedContract[] }>();
  for (const c of unsignedContracts) {
    const existing = contractsByClient.get(c.client.id);
    if (existing) {
      existing.contracts.push(c);
    } else {
      contractsByClient.set(c.client.id, { name: c.client.name, contracts: [c] });
    }
  }
  const unsignedClients = Array.from(contractsByClient.values());

  return (
    <>
      {error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Overdue Payments</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{overdueInvoices.length}</p>
          <p className="text-xs text-ink-muted mt-1">{overdueClients.length} client{overdueClients.length !== 1 ? "s" : ""} with outstanding balances</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Pending Signatures</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{unsignedContracts.length}</p>
          <p className="text-xs text-ink-muted mt-1">{unsignedClients.length} client{unsignedClients.length !== 1 ? "s" : ""} awaiting signature</p>
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
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Invoice</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Days Overdue</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Priority</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Follow-Up Notes</th>
                  {canEdit && <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overdueClients.map((group) =>
                  group.invoices.map((inv, i) => {
                    const days = daysSince(inv.dueDate);
                    return (
                      <tr key={inv.id} className="hover:bg-surface-1 transition-colors border-l-4 border-l-red-500">
                        <td className="px-5 py-3 font-medium text-ink-primary">
                          {i === 0 ? group.name : ""}
                        </td>
                        <td className="px-5 py-3 text-ink-muted text-xs">{inv.invoiceNumber}</td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                            {days} day{days !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="px-5 py-3">{priorityLabel(days)}</td>
                        <td className="px-5 py-3 min-w-[200px]">
                          {canEdit ? (
                            <EditableNote
                              value={inv.notes || ""}
                              onSave={(v) => saveInvoiceNotes(inv.id, v)}
                              placeholder="Add follow-up note..."
                            />
                          ) : (
                            <span className="text-ink-muted">{inv.notes || "—"}</span>
                          )}
                        </td>
                        {canEdit && (
                          <td className="px-5 py-3">
                            <button
                              onClick={() => markInvoicePaid(inv.id)}
                              disabled={marking === inv.id}
                              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              <Check className="h-3 w-3" />
                              {marking === inv.id ? "..." : "Mark Paid"}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
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
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Follow-Up Notes</th>
                  {canEdit && <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unsignedClients.map((group) =>
                  group.contracts.map((c, i) => {
                    const days = daysSince(c.sentAt ?? c.createdAt);
                    return (
                      <tr key={c.id} className="hover:bg-surface-1 transition-colors border-l-4 border-l-amber-500">
                        <td className="px-5 py-3 font-medium text-ink-primary">
                          {i === 0 ? group.name : ""}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            c.status === "SENT" ? "bg-amber-50 text-amber-700" : "bg-surface-2 text-ink-secondary"
                          }`}>
                            {c.status === "SENT" ? "Awaiting Signature" : "Draft"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-ink-secondary">
                          {days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "Today"}
                        </td>
                        <td className="px-5 py-3 min-w-[200px]">
                          {canEdit ? (
                            <EditableNote
                              value={c.notes || ""}
                              onSave={(v) => saveContractNotes(c.id, v)}
                              placeholder="Add follow-up note..."
                            />
                          ) : (
                            <span className="text-ink-muted">{c.notes || "—"}</span>
                          )}
                        </td>
                        {canEdit && (
                          <td className="px-5 py-3">
                            <button
                              onClick={() => markContractSigned(c.id)}
                              disabled={marking === c.id}
                              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              <Check className="h-3 w-3" />
                              {marking === c.id ? "..." : "Mark Signed"}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <p className="text-sm text-ink-muted">No pending signatures.</p>
          </div>
        )}
      </section>
    </>
  );
}
