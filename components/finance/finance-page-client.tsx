"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { ChevronDown, ChevronRight, Palette, Plus } from "lucide-react";
import { CreateInvoiceModal } from "./create-invoice-modal";

// ─── Types ───────────────────────────────────────────────

type Payment = { id: string; amount: unknown; paidAt: string | Date };

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: unknown;
  issuedAt: string | Date | null;
  dueDate: string | Date | null;
  sentAt: string | Date | null;
  paidAt: string | Date | null;
  notes: string | null;
  payments: Payment[];
};

type Contract = {
  id: string;
  title: string;
  status: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  value: unknown;
  notes: string | null;
};

type BillingContact = { name: string; email: string | null };

type ClientRow = {
  id: string;
  name: string;
  rowColor: string | null;
  contracts: Contract[];
  invoices: Invoice[];
  contacts: BillingContact[];
};

interface Props {
  clients: ClientRow[];
  canManage: boolean;
}

// ─── Color presets (matching PDF pastel rows) ────────────

const ROW_COLORS: Record<string, { bg: string; header: string; label: string }> = {
  blue:   { bg: "bg-blue-50",   header: "bg-blue-100",   label: "Blue" },
  green:  { bg: "bg-green-50",  header: "bg-green-100",  label: "Green" },
  pink:   { bg: "bg-pink-50",   header: "bg-pink-100",   label: "Pink" },
  purple: { bg: "bg-purple-50", header: "bg-purple-100", label: "Purple" },
  yellow: { bg: "bg-yellow-50", header: "bg-yellow-100", label: "Yellow" },
  cyan:   { bg: "bg-cyan-50",   header: "bg-cyan-100",   label: "Cyan" },
  white:  { bg: "bg-white",     header: "bg-gray-50",    label: "White" },
};

const DEFAULT_CYCLE = ["blue", "green", "pink", "purple", "yellow", "cyan"];

// ─── Helpers ─────────────────────────────────────────────

function shortDate(d: string | Date | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isoDate(d: string | Date | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function contractLabel(c: Contract): string {
  if (c.status === "SENT") return "SENT / WAITING";
  return c.status;
}

function contractEndLabel(c: Contract): string {
  if (c.endDate) return shortDate(c.endDate);
  const notes = c.notes || "";
  if (notes.toLowerCase().includes("month to month")) return "Month to Month";
  return "—";
}

// ─── Editable Cell Components ────────────────────────────

function EditableAmount({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:bg-white/60 rounded px-1 -mx-1"
        onClick={() => { setDraft(String(value)); setEditing(true); }}
      >
        {formatCurrency(value)}
      </span>
    );
  }

  return (
    <input
      type="number"
      step="0.01"
      className="w-24 rounded border border-border bg-white px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ink-primary"
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); const n = parseFloat(draft); if (!isNaN(n) && n !== value) onSave(n); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
    />
  );
}

function EditableDate({ value, onSave }: { value: string | Date | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(isoDate(value));

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:bg-white/60 rounded px-1 -mx-1 min-w-[60px] inline-block"
        onClick={() => { setDraft(isoDate(value)); setEditing(true); }}
      >
        {shortDate(value) || "—"}
      </span>
    );
  }

  return (
    <input
      type="date"
      className="w-32 rounded border border-border bg-white px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ink-primary"
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const newVal = draft || null;
        const oldVal = isoDate(value) || null;
        if (newVal !== oldVal) onSave(newVal);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
    />
  );
}

function EditableText({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:bg-white/60 rounded px-1 -mx-1 min-w-[40px] inline-block"
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {value || <span className="text-ink-muted">{placeholder || "—"}</span>}
      </span>
    );
  }

  return (
    <input
      type="text"
      className="w-full rounded border border-border bg-white px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ink-primary"
      value={draft}
      autoFocus
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
    />
  );
}

function StatusBadge({ status, paidAt, dueDate }: { status: string; paidAt: string | Date | null; dueDate: string | Date | null }) {
  const isPaid = status === "PAID" || !!paidAt;
  const isOverdue = !isPaid && dueDate && new Date(dueDate) < new Date();
  const isSent = status === "SENT";

  if (isPaid) return <span className="rounded-full bg-green-100 px-2 py-0.5 text-2xs font-semibold text-green-700">PAID</span>;
  if (isOverdue) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-2xs font-semibold text-red-600">OVERDUE</span>;
  if (isSent) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-semibold text-amber-700">SENT</span>;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-2xs font-medium text-gray-500">DRAFT</span>;
}

// ─── Color Picker ────────────────────────────────────────

function ColorPicker({ current, onSelect }: { current: string; onSelect: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const colors = ROW_COLORS[current] || ROW_COLORS.white;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className={cn("h-5 w-5 rounded border border-border", colors.header)}
        title="Change row color"
      />
      {open && (
        <div className="absolute left-0 top-7 z-50 flex gap-1 rounded-lg border border-border bg-white p-2 shadow-lg">
          {Object.entries(ROW_COLORS).map(([key, val]) => (
            <button
              key={key}
              onClick={() => { onSelect(key); setOpen(false); }}
              className={cn(
                "h-6 w-6 rounded border",
                val.header,
                current === key ? "ring-2 ring-ink-primary ring-offset-1" : "border-border"
              )}
              title={val.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────

export function FinancePageClient({ clients, canManage }: Props) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);

  // Stats
  const allInvoices = clients.flatMap((c) => c.invoices);
  const totalOutstanding = allInvoices
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const totalReceived = allInvoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const overdueCount = allInvoices.filter((i) => {
    if (i.status === "OVERDUE") return true;
    if (i.status === "SENT" && i.dueDate && new Date(i.dueDate) < new Date()) return true;
    return false;
  }).length;

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const saveInvoiceField = useCallback(async (invoiceId: string, field: string, value: unknown) => {
    await fetch(`/api/invoices/${invoiceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    router.refresh();
  }, [router]);

  const saveClientColor = useCallback(async (clientId: string, color: string) => {
    await fetch(`/api/clients/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowColor: color }),
    });
    router.refresh();
  }, [router]);

  const clientList = clients.map((c) => c.id);
  const allContracts = clients.flatMap((c) =>
    c.contracts.map((ct) => ({ id: ct.id, title: ct.title, clientId: c.id }))
  );

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Active Clients</p>
          <p className="text-2xl font-bold text-ink-primary">{clients.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Total Invoices</p>
          <p className="text-2xl font-bold text-ink-primary">{allInvoices.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wider mb-1">Received</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalReceived)}</p>
        </div>
      </div>

      {/* Color Legend */}
      <div className="flex items-center gap-6 mb-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-red-400" /> Overdue</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-amber-400" /> Sent / Due</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-green-400" /> Paid</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-border bg-white" /> Draft / Upcoming</span>
        {canManage && (
          <div className="flex-1 text-right">
            <button
              onClick={() => setShowCreateInvoice(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-secondary transition-colors"
            >
              <Plus className="h-3 w-3" /> New Invoice
            </button>
          </div>
        )}
      </div>

      {/* Spreadsheet */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-border bg-gray-100">
                <th className="px-3 py-2.5 text-left font-semibold text-ink-muted uppercase tracking-wider w-8"></th>
                <th className="px-3 py-2.5 text-left font-semibold text-ink-muted uppercase tracking-wider">Client</th>
                <th className="px-3 py-2.5 text-left font-semibold text-ink-muted uppercase tracking-wider">Contract</th>
                <th className="px-3 py-2.5 text-left font-semibold text-ink-muted uppercase tracking-wider">Contract End</th>
                <th className="px-3 py-2.5 text-left font-semibold text-ink-muted uppercase tracking-wider">Invoice Date</th>
                <th className="px-3 py-2.5 text-right font-semibold text-ink-muted uppercase tracking-wider">Amount</th>
                <th className="px-3 py-2.5 text-left font-semibold text-ink-muted uppercase tracking-wider">Invoice Sent</th>
                <th className="px-3 py-2.5 text-left font-semibold text-ink-muted uppercase tracking-wider">Payment Date</th>
                <th className="px-3 py-2.5 text-left font-semibold text-ink-muted uppercase tracking-wider">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold text-ink-muted uppercase tracking-wider">Bill To</th>
                <th className="px-3 py-2.5 text-left font-semibold text-ink-muted uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, clientIdx) => {
                const colorKey = client.rowColor || DEFAULT_CYCLE[clientIdx % DEFAULT_CYCLE.length];
                const colors = ROW_COLORS[colorKey] || ROW_COLORS.white;
                const contract = client.contracts[0] || null;
                const isCollapsed = collapsed[client.id];
                const invoices = client.invoices;
                const billingContact = client.contacts[0];
                const billingEmails = client.contacts.map((c) => c.email).filter(Boolean).join(", ");

                return (
                  <tbody key={client.id} className="border-b border-border">
                    {/* Client Header Row */}
                    <tr className={cn(colors.header, "border-b border-border/50 cursor-pointer")} onClick={() => toggleCollapse(client.id)}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {canManage && (
                            <ColorPicker
                              current={colorKey}
                              onSelect={(c) => saveClientColor(client.id, c)}
                            />
                          )}
                          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-ink-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-ink-primary text-sm" colSpan={1}>
                        {clientIdx + 1}. {client.name}
                      </td>
                      <td className="px-3 py-2.5">
                        {contract ? (
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-2xs font-semibold",
                            contract.status === "SIGNED" ? "bg-green-100 text-green-700" :
                            contract.status === "SENT" ? "bg-amber-100 text-amber-700" :
                            "bg-gray-100 text-gray-600"
                          )}>
                            {contractLabel(contract)}
                          </span>
                        ) : (
                          <span className="text-ink-muted">No contract</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-ink-secondary">
                        {contract ? contractEndLabel(contract) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted" colSpan={3}>
                        {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} ·{" "}
                        {formatCurrency(invoices.reduce((s, i) => s + Number(i.amount), 0))} total
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          {invoices.filter((i) => i.status === "PAID" || i.paidAt).length > 0 && (
                            <span className="text-2xs text-green-600 font-medium">{invoices.filter((i) => i.status === "PAID" || i.paidAt).length} paid</span>
                          )}
                          {invoices.filter((i) => i.status === "OVERDUE" || (i.status === "SENT" && i.dueDate && new Date(i.dueDate) < new Date())).length > 0 && (
                            <span className="text-2xs text-red-600 font-medium">{invoices.filter((i) => i.status === "OVERDUE" || (i.status === "SENT" && i.dueDate && new Date(i.dueDate) < new Date())).length} overdue</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-secondary truncate max-w-[180px]">
                        {billingContact ? billingContact.name : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted truncate max-w-[140px]">
                        {billingEmails || "—"}
                      </td>
                    </tr>

                    {/* Invoice Rows */}
                    {!isCollapsed && invoices.map((inv) => {
                      const isPaid = inv.status === "PAID" || !!inv.paidAt;
                      const isOverdue = !isPaid && inv.dueDate && new Date(inv.dueDate) < new Date();
                      const isSent = inv.status === "SENT" && !isOverdue;

                      const rowBg = isPaid ? "bg-green-50/40" :
                                    isOverdue ? "bg-red-50/40" :
                                    isSent ? "bg-amber-50/40" :
                                    colors.bg;

                      return (
                        <tr key={inv.id} className={cn(rowBg, "border-b border-border/30 hover:bg-white/50 transition-colors")}>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2 text-ink-muted text-2xs">{inv.invoiceNumber}</td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2"></td>
                          {/* Invoice Due Date */}
                          <td className="px-3 py-2 text-ink-secondary">
                            {canManage ? (
                              <EditableDate value={inv.dueDate} onSave={(v) => saveInvoiceField(inv.id, "dueDate", v)} />
                            ) : shortDate(inv.dueDate) || "—"}
                          </td>
                          {/* Amount */}
                          <td className="px-3 py-2 text-right font-medium text-ink-primary">
                            {canManage ? (
                              <EditableAmount value={Number(inv.amount)} onSave={(v) => saveInvoiceField(inv.id, "amount", v)} />
                            ) : formatCurrency(Number(inv.amount))}
                          </td>
                          {/* Sent Date */}
                          <td className="px-3 py-2 text-ink-secondary">
                            {canManage ? (
                              <EditableDate value={inv.sentAt || inv.issuedAt} onSave={(v) => saveInvoiceField(inv.id, "sentAt", v)} />
                            ) : shortDate(inv.sentAt || inv.issuedAt) || "—"}
                          </td>
                          {/* Payment Date */}
                          <td className="px-3 py-2">
                            {canManage ? (
                              <span className={inv.paidAt ? "text-green-700 font-medium" : ""}>
                                <EditableDate value={inv.paidAt} onSave={(v) => saveInvoiceField(inv.id, "paidAt", v)} />
                              </span>
                            ) : (
                              <span className={inv.paidAt ? "text-green-700 font-medium" : "text-ink-muted"}>
                                {shortDate(inv.paidAt) || "—"}
                              </span>
                            )}
                          </td>
                          {/* Status */}
                          <td className="px-3 py-2">
                            <StatusBadge status={inv.status} paidAt={inv.paidAt} dueDate={inv.dueDate} />
                          </td>
                          {/* Bill To */}
                          <td className="px-3 py-2"></td>
                          {/* Notes */}
                          <td className="px-3 py-2 text-ink-muted max-w-[160px]">
                            {canManage ? (
                              <EditableText value={inv.notes || ""} onSave={(v) => saveInvoiceField(inv.id, "notes", v || null)} placeholder="Add note..." />
                            ) : (
                              <span className="truncate block">{inv.notes || ""}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateInvoice && (
        <CreateInvoiceModal
          open={showCreateInvoice}
          onOpenChange={setShowCreateInvoice}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          contracts={allContracts}
        />
      )}
    </>
  );
}
