"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Check, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, Th, Td, TableEmpty } from "@/components/ui/table";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage, daysSince } from "@/lib/form-helpers";

// Client names only — this component never shows financial details.
type UnsignedContract = {
  id: string;
  status: string;
  sentAt: string | Date | null;
  createdAt: string | Date;
  notes: string | null;
  client: { id: string; name: string };
};

interface Props {
  unsignedContracts: UnsignedContract[];
  canEdit: boolean;
}

type Pending = { kind: "contract"; id: string; label: string };

function PriorityBadge({ days }: { days: number }) {
  if (days >= 7) return <Badge tone="danger" size="xs">Urgent</Badge>;
  if (days >= 3) return <Badge tone="warning" size="xs">High</Badge>;
  return <Badge tone="neutral" size="xs">Normal</Badge>;
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
      <button
        type="button"
        className="-mx-1.5 flex min-h-[28px] w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/20"
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {value ? (
          <span className="text-sm text-ink-secondary">{value}</span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-ink-muted">
            <MessageSquare className="h-3.5 w-3.5" /> {placeholder || "Add note…"}
          </span>
        )}
      </button>
    );
  }

  return (
    <textarea
      className="w-full resize-none rounded-lg border border-ink-primary bg-white px-2 py-1.5 text-sm text-ink-primary shadow-inset focus:outline-none focus:ring-2 focus:ring-ink-primary/15"
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

export function FollowUpClient({ unsignedContracts, canEdit }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [marking, setMarking] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  // PUT helper: surfaces API errors instead of silently refreshing.
  const update = useCallback(async (url: string, body: Record<string, unknown>, fallback: string) => {
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast({ title: apiErrorMessage(data, fallback), variant: "error" });
        return false;
      }
      router.refresh();
      return true;
    } catch {
      toast({ title: fallback, variant: "error" });
      return false;
    }
  }, [router, toast]);

  const saveContractNotes = useCallback((contractId: string, notes: string) =>
    update(`/api/contracts/${contractId}`, { notes: notes || null }, "Failed to save note"), [update]);

  const markContractSigned = useCallback(async (contractId: string) => {
    setMarking(contractId);
    const ok = await update(`/api/contracts/${contractId}`, { status: "SIGNED" }, "Failed to mark signed");
    if (ok) toast({ title: "Contract marked signed", variant: "success" });
    setMarking(null);
  }, [update, toast]);

  async function confirmPending() {
    if (!pending) return;
    const target = pending;
    setPending(null);
    await markContractSigned(target.id);
  }

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

  const contractCols = canEdit ? 5 : 4;

  return (
    <div className="space-y-6 pb-10">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Pending Signatures"
          value={unsignedContracts.length}
          tone={unsignedContracts.length > 0 ? "warning" : "neutral"}
          icon={<FileText />}
          hint={`${unsignedClients.length} client${unsignedClients.length !== 1 ? "s" : ""} awaiting signature`}
        />
      </div>

      {/* Pending signatures */}
      <Card padding="none" className="overflow-hidden">
        <CardHeader
          className="mb-0 border-b border-border px-5 py-4"
          eyebrow="Follow up"
          title="Pending contract signatures"
          description="Contracts still in draft or awaiting a signature"
        />
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Status</Th>
                <Th>Days pending</Th>
                <Th className="min-w-[220px]">Follow-up notes</Th>
                {canEdit && <Th align="right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {unsignedClients.length === 0 ? (
                <TableEmpty colSpan={contractCols}>No pending signatures.</TableEmpty>
              ) : (
                unsignedClients.map((group) =>
                  group.contracts.map((c, i) => {
                    const days = daysSince(c.sentAt ?? c.createdAt);
                    return (
                      <tr key={c.id}>
                        <Td className="whitespace-nowrap font-medium text-ink-primary">
                          {i === 0 ? group.name : ""}
                        </Td>
                        <Td>
                          <Badge tone={c.status === "SENT" ? "warning" : "neutral"} size="xs">
                            {c.status === "SENT" ? "Awaiting signature" : "Draft"}
                          </Badge>
                        </Td>
                        <Td className="whitespace-nowrap tabular text-ink-secondary">
                          {days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "Today"}
                        </Td>
                        <Td className="min-w-[220px]">
                          {canEdit ? (
                            <EditableNote
                              value={c.notes || ""}
                              onSave={(v) => saveContractNotes(c.id, v)}
                              placeholder="Add follow-up note…"
                            />
                          ) : (
                            <span className="text-ink-muted">{c.notes || "—"}</span>
                          )}
                        </Td>
                        {canEdit && (
                          <Td align="right">
                            <Button
                              size="xs"
                              variant="secondary"
                              leftIcon={<Check className="h-3 w-3" />}
                              loading={marking === c.id}
                              onClick={() => setPending({ kind: "contract", id: c.id, label: group.name })}
                            >
                              Mark signed
                            </Button>
                          </Td>
                        )}
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      <ConfirmModal
        open={!!pending}
        onOpenChange={(o) => { if (!o) setPending(null); }}
        title="Mark contract as signed?"
        description={pending ? `${pending.label} — this updates the record for everyone.` : undefined}
        confirmLabel="Mark signed"
        onConfirm={confirmPending}
      />
    </div>
  );
}
