"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup } from "@/components/ui/form-field";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: { id: string; name: string }[];
  contracts: { id: string; title: string; clientId: string }[];
}

export function CreateInvoiceModal({ open, onOpenChange, clients, contracts }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState("");

  const filteredContracts = contracts.filter((c) => c.clientId === selectedClient);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    const body = {
      clientId: form.get("clientId") as string,
      contractId: (form.get("contractId") as string) || undefined,
      invoiceNumber: form.get("invoiceNumber") as string,
      amount: parseFloat(form.get("amount") as string),
      dueDate: (form.get("dueDate") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
    };

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create invoice");
      setLoading(false);
      return;
    }

    setSelectedClient("");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Invoice" description="Create an invoice for a client">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <FormGroup label="Client" htmlFor="inv-client" required>
          <Select
            id="inv-client"
            name="clientId"
            required
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="">Select client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </FormGroup>

        {filteredContracts.length > 0 && (
          <FormGroup label="Contract (optional)" htmlFor="inv-contract">
            <Select id="inv-contract" name="contractId">
              <option value="">No contract linked</option>
              {filteredContracts.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </Select>
          </FormGroup>
        )}

        <FormGroup label="Invoice Number" htmlFor="inv-number" required>
          <Input id="inv-number" name="invoiceNumber" placeholder="e.g., EBPR-2026-001" required autoFocus />
        </FormGroup>

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Amount ($)" htmlFor="inv-amount" required>
            <Input id="inv-amount" name="amount" type="number" step="0.01" min="0" placeholder="0.00" required />
          </FormGroup>
          <FormGroup label="Due Date" htmlFor="inv-due">
            <Input id="inv-due" name="dueDate" type="date" />
          </FormGroup>
        </div>

        <FormGroup label="Notes" htmlFor="inv-notes">
          <Textarea id="inv-notes" name="notes" rows={3} placeholder="Internal notes..." />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Invoice"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
