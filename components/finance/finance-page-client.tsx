"use client";

import { useState, useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { ChevronDown, ChevronRight, Plus, ArrowRightLeft, Trash2, DollarSign, Search } from "lucide-react";
import { Button, Input } from "@/components/ui/form-field";
import { Badge, humanize, statusTone, type BadgeTone } from "@/components/ui/badge";
import { TableWrap } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/header";
import {
  DropdownMenu,
  DropdownMenuDots,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CreateInvoiceModal } from "./create-invoice-modal";
import { RecordPaymentModal } from "./record-payment-modal";
import {
  apiErrorMessage,
  formatDateOnly,
  isInvoiceOverdue,
  isInvoicePaid,
  toDateInputValue,
} from "./invoice-status";
import { setClientRowColor } from "@/app/(dashboard)/finance/actions";

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

// ─── Color presets (matching PDF pastel rows, softened) ──

const ROW_COLORS: Record<string, { bg: string; header: string; swatch: string; label: string }> = {
  blue:   { bg: "bg-blue-50/60",   header: "bg-blue-100/70",   swatch: "bg-blue-200",   label: "Blue" },
  green:  { bg: "bg-green-50/60",  header: "bg-green-100/70",  swatch: "bg-green-200",  label: "Green" },
  pink:   { bg: "bg-pink-50/60",   header: "bg-pink-100/70",   swatch: "bg-pink-200",   label: "Pink" },
  purple: { bg: "bg-purple-50/60", header: "bg-purple-100/70", swatch: "bg-purple-200", label: "Purple" },
  yellow: { bg: "bg-yellow-50/60", header: "bg-yellow-100/70", swatch: "bg-yellow-200", label: "Yellow" },
  cyan:   { bg: "bg-cyan-50/60",   header: "bg-cyan-100/70",   swatch: "bg-cyan-200",   label: "Cyan" },
  white:  { bg: "bg-white",        header: "bg-surface-2",     swatch: "bg-white",      label: "White" },
};

const DEFAULT_CYCLE = ["blue", "green", "pink", "purple", "yellow", "cyan"];

// ─── Helpers ─────────────────────────────────────────────

function contractLabel(c: Contract): string {
  if (c.status === "SENT") return "Sent / Waiting";
  return humanize(c.status);
}

function contractEndLabel(c: Contract): string {
  if (c.endDate) return formatDateOnly(c.endDate);
  const notes = c.notes || "";
  if (notes.toLowerCase().includes("month to month")) return "Month to Month";
  return "—";
}

type InvoiceVisual = "PAID" | "OVERDUE" | "SENT" | "CANCELLED" | "DRAFT";

function invoiceVisual(inv: Invoice): InvoiceVisual {
  if (isInvoicePaid(inv)) return "PAID";
  if (inv.status === "CANCELLED") return "CANCELLED";
  if (isInvoiceOverdue(inv)) return "OVERDUE";
  if (inv.status === "SENT") return "SENT";
  return "DRAFT";
}

const VISUAL_TONE: Record<InvoiceVisual, BadgeTone> = {
  PAID: "success",
  OVERDUE: "danger",
  SENT: "warning",
  CANCELLED: "neutral",
  DRAFT: "outline",
};

// Pill styling for the inline status <select>; mirrors Badge tones.
const SELECT_TONE: Record<InvoiceVisual, string> = {
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  OVERDUE: "bg-red-50 text-red-700 ring-red-600/15",
  SENT: "bg-amber-50 text-amber-700 ring-amber-600/15",
  CANCELLED: "bg-surface-2 text-ink-secondary ring-border line-through",
  DRAFT: "bg-white text-ink-secondary ring-border-strong",
};

const ROW_STYLES: Partial<Record<InvoiceVisual, string>> = {
  PAID: "bg-emerald-50/40",
  OVERDUE: "bg-red-50/40",
  SENT: "bg-amber-50/40",
  CANCELLED: "bg-surface-2/60 text-ink-muted",
};

// Cell + editable-control styling shared across the sheet.
const CELL = "px-3 py-1.5 align-middle text-xs";
const HEAD = "sticky top-0 z-10 whitespace-nowrap bg-surface-2/95 px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-ink-muted backdrop-blur";
const EDIT_DISPLAY = "-mx-1.5 inline-block cursor-text rounded-md px-1.5 py-0.5 transition-colors hover:bg-white hover:ring-1 hover:ring-border-strong";
const EDIT_INPUT = "h-7 rounded-md border border-ink-primary bg-white px-1.5 text-xs text-ink-primary shadow-inset focus:outline-none focus:ring-2 focus:ring-ink-primary/15";
const QUICK_INPUT = "h-7 rounded-md border border-border bg-white px-1.5 text-xs text-ink-primary placeholder:text-ink-muted hover:border-border-strong focus:border-ink-primary focus:outline-none focus:ring-2 focus:ring-ink-primary/15";

// ─── Editable Cell Components ────────────────────────────

function EditableAmount({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (!editing) {
    return (
      <span
        className={cn(EDIT_DISPLAY, "tabular")}
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
      min="0.01"
      className={cn(EDIT_INPUT, "w-24 text-right font-medium tabular")}
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); const n = parseFloat(draft); if (!isNaN(n) && n > 0 && n !== value) onSave(n); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false); } }}
    />
  );
}

function EditableDate({ value, onSave }: { value: string | Date | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toDateInputValue(value));

  if (!editing) {
    return (
      <span
        className={cn(EDIT_DISPLAY, "min-w-[60px] whitespace-nowrap tabular")}
        onClick={() => { setDraft(toDateInputValue(value)); setEditing(true); }}
      >
        {formatDateOnly(value) || <span className="text-ink-muted">—</span>}
      </span>
    );
  }

  return (
    <input
      type="date"
      className={cn(EDIT_INPUT, "w-32")}
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const newVal = draft || null;
        const oldVal = toDateInputValue(value) || null;
        if (newVal !== oldVal) onSave(newVal);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(toDateInputValue(value)); setEditing(false); } }}
    />
  );
}

function EditableText({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <span
        className={cn(EDIT_DISPLAY, "block min-w-[40px] max-w-[220px] truncate")}
        title={value || undefined}
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {value || <span className="text-ink-muted">{placeholder || "—"}</span>}
      </span>
    );
  }

  return (
    <input
      type="text"
      className={cn(EDIT_INPUT, "w-full min-w-[160px]")}
      value={draft}
      autoFocus
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
    />
  );
}

// ─── Color Picker ────────────────────────────────────────

function ColorPicker({ current, onSelect }: { current: string; onSelect: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const colors = ROW_COLORS[current] || ROW_COLORS.white;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Stop clicks bubbling to the header row, which would toggle collapse.
  return (
    <div className="relative inline-block" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "h-4 w-4 rounded-full border border-ink-primary/15 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/25",
          colors.swatch
        )}
        title="Change row color"
        aria-label="Change row color"
      />
      {open && (
        <div className="absolute left-0 top-6 z-30 flex gap-1.5 rounded-xl border border-border bg-white p-2 shadow-pop">
          {Object.entries(ROW_COLORS).map(([key, val]) => (
            <button
              key={key}
              type="button"
              onClick={() => { onSelect(key); setOpen(false); }}
              className={cn(
                "h-5 w-5 rounded-full border border-ink-primary/15 transition-transform hover:scale-110",
                val.swatch,
                current === key && "ring-2 ring-ink-primary ring-offset-1"
              )}
              title={val.label}
              aria-label={val.label}
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
  canPay,
  onPay,
  onReassign,
  onDelete,
}: {
  invoiceId: string;
  currentClientId: string;
  allClients: { id: string; name: string }[];
  canPay: boolean;
  onPay: () => void;
  onReassign: (invoiceId: string, newClientId: string) => void;
  onDelete: (invoiceId: string) => void;
}) {
  const [showMove, setShowMove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = allClients
    .filter((c) => c.id !== currentClientId)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuDots className="h-7 w-7" label="Invoice actions" />
        <DropdownMenuContent align="start">
          {canPay && (
            <DropdownMenuItem icon={<DollarSign />} onSelect={onPay}>
              Record payment
            </DropdownMenuItem>
          )}
          <DropdownMenuItem icon={<ArrowRightLeft />} onSelect={() => { setSearch(""); setShowMove(true); }}>
            Move to client…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => setConfirmDelete(true)}>
            Delete invoice
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal open={showMove} onOpenChange={setShowMove} title="Move invoice" description="Reassign this invoice to another client." size="sm">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              type="text"
              placeholder="Search clients…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onReassign(invoiceId, c.id); setShowMove(false); }}
                className="block w-full truncate border-b border-border px-3 py-2 text-left text-sm text-ink-primary transition-colors last:border-b-0 hover:bg-surface-2"
              >
                {c.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-muted">No matching clients</p>}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this invoice?"
        description="This cannot be undone."
        confirmLabel="Delete invoice"
        destructive
        onConfirm={() => { setConfirmDelete(false); onDelete(invoiceId); }}
      />
    </>
  );
}

// ─── Quick Add Invoice Form ──────────────────────────────

function QuickAddInvoice({ clientId, clientName, contractId, onDone, onError }: {
  clientId: string;
  clientName: string;
  contractId: string | null;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0) return;
    setSaving(true);
    const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").substring(0, 8).toUpperCase();
    const now = new Date();
    const invoiceNumber = `EBPR-${slug}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          contractId: contractId ?? undefined,
          invoiceNumber,
          amount: n,
          dueDate: dueDate || undefined,
          sentAt: sentAt || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        onError(apiErrorMessage(data, "Failed to create invoice"));
        setSaving(false);
        return;
      }
    } catch {
      onError("Network error — invoice not created");
      setSaving(false);
      return;
    }
    setSaving(false);
    onDone();
  }

  return (
    <tr className="border-t border-dashed border-border-strong bg-white">
      <td className={CELL}></td>
      <td className={cn(CELL, "italic text-ink-muted")}>New invoice</td>
      <td className={CELL}></td>
      <td className={CELL}></td>
      <td className={CELL}>
        <input type="date" title="Due date" className={cn(QUICK_INPUT, "w-32")} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </td>
      <td className={cn(CELL, "text-right")}>
        <input type="number" step="0.01" min="0.01" placeholder="$0.00" className={cn(QUICK_INPUT, "w-24 text-right tabular")} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onDone(); }} />
      </td>
      <td className={CELL}>
        <input type="date" title="Date sent (optional)" className={cn(QUICK_INPUT, "w-32")} value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
      </td>
      <td className={CELL}></td>
      <td className={CELL}>
        <div className="flex gap-1.5">
          <Button type="button" size="xs" onClick={save} disabled={!amount} loading={saving}>Save</Button>
          <Button type="button" size="xs" variant="ghost" onClick={onDone} disabled={saving}>Cancel</Button>
        </div>
      </td>
      <td className={CELL}></td>
      <td className={CELL}>
        <input type="text" placeholder="Notes…" className={cn(QUICK_INPUT, "w-full min-w-[160px]")} value={notes} onChange={(e) => setNotes(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
      </td>
    </tr>
  );
}

// ─── Main Component ──────────────────────────────────────

export function FinancePageClient({ clients, canManage }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [addingInvoiceFor, setAddingInvoiceFor] = useState<string | null>(null);
  const [payInvoice, setPayInvoice] = useState<Invoice & { client: { name: string } } | null>(null);

  const showError = useCallback((message: string) => toast({ title: message, variant: "error" }), [toast]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Shared mutation helper: surfaces API errors and refreshes on success.
  const request = useCallback(async (url: string, init: RequestInit, fallback: string, success?: string) => {
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showError(apiErrorMessage(data, fallback));
        return false;
      }
      if (success) toast({ title: success, variant: "success" });
      router.refresh();
      return true;
    } catch {
      showError(fallback);
      return false;
    }
  }, [router, showError, toast]);

  const saveInvoiceField = useCallback((invoiceId: string, field: string, value: unknown) =>
    request(`/api/invoices/${invoiceId}`, { method: "PUT", body: JSON.stringify({ [field]: value }) }, "Failed to save change"),
  [request]);

  const saveClientColor = useCallback((clientId: string, color: string) => {
    startTransition(async () => {
      const result = await setClientRowColor(clientId, color);
      if (!result.ok) showError(result.error);
      else router.refresh();
    });
  }, [router, showError]);

  const reassignInvoice = useCallback((invoiceId: string, newClientId: string) =>
    request("/api/invoices/reassign", { method: "POST", body: JSON.stringify({ invoiceId, newClientId }) }, "Failed to move invoice", "Invoice moved"),
  [request]);

  const deleteInvoice = useCallback((invoiceId: string) =>
    request(`/api/invoices/${invoiceId}`, { method: "DELETE" }, "Failed to delete invoice", "Invoice deleted"),
  [request]);

  const allClientList = clients.map((c) => ({ id: c.id, name: c.name }));
  const allContracts = clients.flatMap((c) =>
    c.contracts.map((ct) => ({ id: ct.id, title: ct.title, clientId: c.id }))
  );

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Accounting — Active Clients"
        actions={canManage ? (
          <Button onClick={() => setShowCreateInvoice(true)} leftIcon={<Plus className="h-4 w-4" />}>
            New Invoice
          </Button>
        ) : undefined}
      />

      <div className="space-y-4">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="danger" dot>Overdue</Badge>
          <Badge tone="warning" dot>Sent / Due</Badge>
          <Badge tone="success" dot>Paid</Badge>
          <Badge tone="outline" dot>Draft / Upcoming</Badge>
          <span className="ml-auto hidden text-xs text-ink-muted sm:inline">Click a cell to edit · Enter to save · Esc to cancel</span>
        </div>

        {/* Spreadsheet */}
        {clients.length === 0 ? (
          <EmptyState
            title="No active clients"
            description="Invoices appear here once a client is marked active."
          />
        ) : (
          <TableWrap maxHeight="calc(100vh - 220px)">
            <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th className={cn(HEAD, "w-10")}></th>
                  <th className={cn(HEAD, "min-w-[200px]")}>Client</th>
                  <th className={HEAD}>Contract</th>
                  <th className={HEAD}>Contract End</th>
                  <th className={HEAD}>Invoice Due</th>
                  <th className={cn(HEAD, "text-right")}>Amount</th>
                  <th className={HEAD}>Invoice Sent</th>
                  <th className={HEAD}>Payment Date</th>
                  <th className={HEAD}>Status</th>
                  <th className={HEAD}>Bill To</th>
                  <th className={cn(HEAD, "min-w-[180px]")}>Notes</th>
                </tr>
              </thead>
              {/* One <tbody> per client (a <tbody> may not nest inside another <tbody>). */}
              {clients.map((client, clientIdx) => {
                const colorKey = client.rowColor || DEFAULT_CYCLE[clientIdx % DEFAULT_CYCLE.length];
                const colors = ROW_COLORS[colorKey] || ROW_COLORS.white;
                const contract = client.contracts[0] || null;
                const isCollapsed = collapsed[client.id];
                const invoices = client.invoices;
                const billingContact = client.contacts[0];
                const billingEmails = client.contacts.map((c) => c.email).filter(Boolean).join(", ");
                const activeInvoices = invoices.filter((i) => i.status !== "CANCELLED");
                const paidCount = activeInvoices.filter(isInvoicePaid).length;
                const overdueCount = activeInvoices.filter((i) => isInvoiceOverdue(i)).length;

                return (
                  <tbody key={client.id} className="border-t border-border">
                    {/* Client Header Row */}
                    <tr
                      className={cn(colors.header, "cursor-pointer select-none transition-colors hover:brightness-[0.98]")}
                      onClick={() => toggleCollapse(client.id)}
                    >
                      <td className={cn(CELL, "py-2")}>
                        <div className="flex items-center gap-2">
                          {canManage && (
                            <ColorPicker
                              current={colorKey}
                              onSelect={(c) => saveClientColor(client.id, c)}
                            />
                          )}
                          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-ink-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />}
                        </div>
                      </td>
                      <td className={cn(CELL, "py-2 text-sm font-semibold text-ink-primary")}>
                        <span className="mr-1.5 tabular text-ink-muted">{clientIdx + 1}.</span>
                        {client.name}
                      </td>
                      <td className={cn(CELL, "py-2")}>
                        {contract ? (
                          <Badge tone={statusTone(contract.status)} size="xs">{contractLabel(contract)}</Badge>
                        ) : (
                          <span className="text-ink-muted">No contract</span>
                        )}
                      </td>
                      <td className={cn(CELL, "py-2 whitespace-nowrap tabular text-ink-secondary")}>
                        {contract ? contractEndLabel(contract) : "—"}
                      </td>
                      <td className={cn(CELL, "py-2 text-ink-muted")} colSpan={3}>
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap tabular">
                            {activeInvoices.length} invoice{activeInvoices.length !== 1 ? "s" : ""} ·{" "}
                            {formatCurrency(activeInvoices.reduce((s, i) => s + Number(i.amount), 0))} total
                          </span>
                          {canManage && (
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              className="h-6 px-2 text-2xs"
                              leftIcon={<Plus className="h-3 w-3" />}
                              onClick={(e) => { e.stopPropagation(); setCollapsed((prev) => ({ ...prev, [client.id]: false })); setAddingInvoiceFor(client.id); }}
                            >
                              Add
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className={cn(CELL, "py-2")}>
                        <div className="flex flex-wrap gap-1">
                          {paidCount > 0 && <Badge tone="success" size="xs">{paidCount} paid</Badge>}
                          {overdueCount > 0 && <Badge tone="danger" size="xs">{overdueCount} overdue</Badge>}
                        </div>
                      </td>
                      <td className={cn(CELL, "max-w-[180px] truncate py-2 text-ink-secondary")}>
                        {billingContact ? billingContact.name : "—"}
                      </td>
                      <td className={cn(CELL, "max-w-[180px] truncate py-2 text-ink-muted")} title={billingEmails || undefined}>
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
                        onError={showError}
                      />
                    )}
                    {!isCollapsed && invoices.map((inv) => {
                      const visual = invoiceVisual(inv);
                      const rowBg = ROW_STYLES[visual] ?? colors.bg;
                      const canPay = visual !== "PAID" && visual !== "CANCELLED";

                      return (
                        <tr key={inv.id} className={cn(rowBg, "border-t border-border/60 transition-colors hover:brightness-[0.985]")}>
                          <td className={cn(CELL, "py-1")}>
                            {canManage && (
                              <InvoiceActions
                                invoiceId={inv.id}
                                currentClientId={client.id}
                                allClients={allClientList}
                                canPay={canPay}
                                onPay={() => setPayInvoice({ ...inv, client: { name: client.name } })}
                                onReassign={reassignInvoice}
                                onDelete={deleteInvoice}
                              />
                            )}
                          </td>
                          <td className={cn(CELL, "whitespace-nowrap font-mono text-2xs text-ink-muted")}>{inv.invoiceNumber}</td>
                          <td className={CELL}></td>
                          <td className={CELL}></td>
                          {/* Invoice Due Date */}
                          <td className={cn(CELL, "whitespace-nowrap tabular text-ink-secondary")}>
                            {canManage ? (
                              <EditableDate value={inv.dueDate} onSave={(v) => saveInvoiceField(inv.id, "dueDate", v)} />
                            ) : formatDateOnly(inv.dueDate) || "—"}
                          </td>
                          {/* Amount */}
                          <td className={cn(CELL, "whitespace-nowrap text-right font-medium tabular text-ink-primary")}>
                            {canManage ? (
                              <EditableAmount value={Number(inv.amount)} onSave={(v) => saveInvoiceField(inv.id, "amount", v)} />
                            ) : formatCurrency(Number(inv.amount))}
                          </td>
                          {/* Sent Date */}
                          <td className={cn(CELL, "whitespace-nowrap tabular text-ink-secondary")}>
                            {canManage ? (
                              <EditableDate value={inv.sentAt || inv.issuedAt} onSave={(v) => saveInvoiceField(inv.id, "sentAt", v)} />
                            ) : formatDateOnly(inv.sentAt || inv.issuedAt) || "—"}
                          </td>
                          {/* Payment Date */}
                          <td className={cn(CELL, "whitespace-nowrap tabular")}>
                            {canManage ? (
                              <span className={inv.paidAt ? "font-medium text-emerald-700" : ""}>
                                <EditableDate value={inv.paidAt} onSave={(v) => saveInvoiceField(inv.id, "paidAt", v)} />
                              </span>
                            ) : (
                              <span className={inv.paidAt ? "font-medium text-emerald-700" : "text-ink-muted"}>
                                {formatDateOnly(inv.paidAt) || "—"}
                              </span>
                            )}
                          </td>
                          {/* Status + Actions */}
                          <td className={CELL}>
                            <div className="flex items-center gap-1.5">
                              {canManage ? (
                                <select
                                  className={cn(
                                    "h-6 cursor-pointer appearance-none rounded-full border-0 px-2.5 text-2xs font-semibold uppercase tracking-wide ring-1 ring-inset transition-shadow",
                                    "hover:ring-ink-primary/30 focus:outline-none focus:ring-2 focus:ring-ink-primary/25",
                                    SELECT_TONE[visual]
                                  )}
                                  title="Change status"
                                  value={isInvoicePaid(inv) ? "PAID" : inv.status}
                                  onChange={(e) => saveInvoiceField(inv.id, "status", e.target.value)}
                                >
                                  <option value="DRAFT">DRAFT</option>
                                  <option value="SENT">SENT</option>
                                  <option value="PAID">PAID</option>
                                  <option value="OVERDUE">OVERDUE</option>
                                  <option value="CANCELLED">CANCELLED</option>
                                </select>
                              ) : (
                                <Badge tone={VISUAL_TONE[visual]} size="xs" className={visual === "CANCELLED" ? "line-through" : undefined}>
                                  {humanize(visual)}
                                </Badge>
                              )}
                              {canManage && canPay && (
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="secondary"
                                  className="h-6 px-2 text-2xs"
                                  onClick={() => setPayInvoice({ ...inv, client: { name: client.name } })}
                                >
                                  Pay
                                </Button>
                              )}
                            </div>
                          </td>
                          {/* Bill To */}
                          <td className={CELL}></td>
                          {/* Notes */}
                          <td className={cn(CELL, "max-w-[240px] text-ink-muted")}>
                            {canManage ? (
                              <EditableText value={inv.notes || ""} onSave={(v) => saveInvoiceField(inv.id, "notes", v || null)} placeholder="Add note…" />
                            ) : (
                              <span className="block truncate" title={inv.notes || undefined}>{inv.notes || ""}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </TableWrap>
        )}
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
