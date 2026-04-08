"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { ChevronDown, ChevronRight, Plus, ArrowRightLeft, Trash2, MoreHorizontal } from "lucide-react";
import { CreateInvoiceModal } from "./create-invoice-modal";
import { RecordPaymentModal } from "./record-payment-modal";

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

// ─── Invoice Actions Menu ────────────────────────────────

function InvoiceActions({
  invoiceId,
  currentClientId,
  allClients,
  onReassign,
  onDelete,
}: {
  invoiceId: string;
  currentClientId: string;
  allClients: { id: string; name: string }[];
  onReassign: (invoiceId: string, newClientId: string) => void;
  onDelete: (invoiceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowMove(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = allClients
    .filter((c) => c.id !== currentClientId)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); setShowMove(false); }}
        className="p-1.5 rounded-md border border-border bg-white hover:bg-surface-1 text-ink-muted hover:text-ink-primary transition-colors shadow-sm"
        title="Actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && !showMove && (
        <div className="absolute right-0 top-6 z-50 w-40 rounded-lg border border-border bg-white shadow-lg py-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMove(true)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-surface-1 transition-colors"
          >
            <ArrowRightLeft className="h-3 w-3" /> Move to client...
          </button>
          <button
            onClick={() => { if (confirm("Delete this invoice?")) { onDelete(invoiceId); setOpen(false); } }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Delete invoice
          </button>
        </div>
      )}
      {open && showMove && (
        <div className="absolute right-0 top-6 z-50 w-56 rounded-lg border border-border bg-white shadow-lg p-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            placeholder="Search client..."
            className="w-full rounded border border-border px-2 py-1 text-xs mb-1 focus:outline-none focus:ring-1 focus:ring-ink-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => { onReassign(invoiceId, c.id); setOpen(false); setShowMove(false); }}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-surface-1 rounded transition-colors truncate"
              >
                {c.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-2xs text-ink-muted px-2 py-1">No matches</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quick Add Invoice Form ──────────────────────────────

function QuickAddInvoice({ clientId, clientName, contractId, onDone }: {
  clientId: string;
  clientName: string;
  contractId: string | null;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 8).toUpperCase();
  const now = new Date();
  const invoiceNumber = `EBPR-${slug}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

  async function save() {
    if (!amount) return;
    setSaving(true);
    await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        contractId,
        invoiceNumber,
        amount: parseFloat(amount),
        dueDate: dueDate || undefined,
        notes: notes || undefined,
      }),
    });
    setSaving(false);
    onDone();
  }

  return (
    <tr className="bg-blue-50/30 border-b border-border/30">
      <td className="px-3 py-1.5"></td>
      <td className="px-3 py-1.5 text-2xs text-ink-muted italic">New invoice</td>
      <td className="px-3 py-1.5"></td>
      <td className="px-3 py-1.5"></td>
      <td className="px-3 py-1.5">
        <input type="date" className="w-28 rounded border border-border bg-white px-1.5 py-0.5 text-xs" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </td>
      <td className="px-3 py-1.5 text-right">
        <input type="number" step="0.01" placeholder="$0.00" className="w-20 rounded border border-border bg-white px-1.5 py-0.5 text-xs text-right" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </td>
      <td className="px-3 py-1.5"></td>
      <td className="px-3 py-1.5"></td>
      <td className="px-3 py-1.5">
        <div className="flex gap-1">
          <button onClick={save} disabled={saving || !amount} className="rounded bg-ink-primary px-2 py-0.5 text-2xs font-medium text-white disabled:opacity-40">Save</button>
          <button onClick={onDone} className="rounded bg-gray-200 px-2 py-0.5 text-2xs font-medium text-ink-secondary">Cancel</button>
        </div>
      </td>
      <td className="px-3 py-1.5"></td>
      <td className="px-3 py-1.5">
        <input type="text" placeholder="Notes..." className="w-full rounded border border-border bg-white px-1.5 py-0.5 text-xs" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </td>
    </tr>
  );
}

// ─── Main Component ──────────────────────────────────────

export function FinancePageClient({ clients, canManage }: Props) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [addingInvoiceFor, setAddingInvoiceFor] = useState<string | null>(null);
  const [payInvoice, setPayInvoice] = useState<Invoice & { client: { name: string } } | null>(null);

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

  const reassignInvoice = useCallback(async (invoiceId: string, newClientId: string) => {
    await fetch("/api/invoices/reassign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, newClientId }),
    });
    router.refresh();
  }, [router]);

  const deleteInvoice = useCallback(async (invoiceId: string) => {
    await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
    router.refresh();
  }, [router]);

  const allClientList = clients.map((c) => ({ id: c.id, name: c.name }));
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
                        {canManage && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setAddingInvoiceFor(client.id); }}
                            className="ml-2 inline-flex items-center gap-0.5 rounded bg-ink-primary/10 px-1.5 py-0.5 text-2xs font-medium text-ink-primary hover:bg-ink-primary/20 transition-colors"
                          >
                            <Plus className="h-2.5 w-2.5" /> Add
                          </button>
                        )}
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
                    {!isCollapsed && addingInvoiceFor === client.id && (
                      <QuickAddInvoice
                        clientId={client.id}
                        clientName={client.name}
                        contractId={contract?.id || null}
                        onDone={() => { setAddingInvoiceFor(null); router.refresh(); }}
                      />
                    )}
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
                          <td className="px-3 py-2">
                            {canManage && (
                              <InvoiceActions
                                invoiceId={inv.id}
                                currentClientId={client.id}
                                allClients={allClientList}
                                onReassign={reassignInvoice}
                                onDelete={deleteInvoice}
                              />
                            )}
                          </td>
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
                          {/* Status + Actions */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              {canManage ? (
                                <select
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-2xs font-semibold border-0 cursor-pointer appearance-none",
                                    inv.status === "PAID" || inv.paidAt ? "bg-green-100 text-green-700" :
                                    inv.status === "OVERDUE" || (!inv.paidAt && inv.dueDate && new Date(inv.dueDate) < new Date()) ? "bg-red-100 text-red-600" :
                                    inv.status === "SENT" ? "bg-amber-100 text-amber-700" :
                                    "bg-gray-100 text-gray-500"
                                  )}
                                  value={inv.paidAt ? "PAID" : inv.status}
                                  onChange={(e) => saveInvoiceField(inv.id, "status", e.target.value)}
                                >
                                  <option value="DRAFT">DRAFT</option>
                                  <option value="SENT">SENT</option>
                                  <option value="PAID">PAID</option>
                                  <option value="OVERDUE">OVERDUE</option>
                                  <option value="CANCELLED">CANCELLED</option>
                                </select>
                              ) : (
                                <StatusBadge status={inv.status} paidAt={inv.paidAt} dueDate={inv.dueDate} />
                              )}
                              {canManage && inv.status !== "PAID" && !inv.paidAt && (
                                <button
                                  onClick={() => setPayInvoice({ ...inv, client: { name: client.name } })}
                                  className="rounded bg-green-600 px-1.5 py-0.5 text-2xs font-medium text-white hover:bg-green-700 transition-colors whitespace-nowrap"
                                >
                                  $ Pay
                                </button>
                              )}
                            </div>
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
