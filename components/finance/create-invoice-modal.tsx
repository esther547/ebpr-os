"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/components/finance/invoice-status";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: { id: string; name: string }[];
  contracts: { id: string; title: string; clientId: string }[];
}

export function CreateInvoiceModal({ open, onOpenChange, clients, contracts }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");

  const filteredContracts = contracts.filter((c) => c.clientId === selectedClient);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const body = {
      clientId: form.get("clientId") as string,
      contractId: (form.get("contractId") as string) || undefined,
      invoiceNumber: form.get("invoiceNumber") as string,
      amount: parseFloat(form.get("amount") as string),
      dueDate: (form.get("dueDate") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
    };

    let res: Response;
    try {
      res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      toast({ title: "Network error — invoice not created", variant: "error" });
      setLoading(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast({ title: apiErrorMessage(data, "Failed to create invoice"), variant: "error" });
      setLoading(false);
      return;
    }

    setSelectedClient("");
    setLoading(false);
    onOpenChange(false);
    toast({ title: "Invoice created", variant: "success" });
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Invoice" description="Create an invoice for a client">
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="grid gap-4 sm:grid-cols-2">
          <FormGroup label="Amount ($)" htmlFor="inv-amount" required>
            <Input id="inv-amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" required />
          </FormGroup>
          <FormGroup label="Due Date" htmlFor="inv-due">
            <Input id="inv-due" name="dueDate" type="date" />
          </FormGroup>
        </div>

        <FormGroup label="Notes" htmlFor="inv-notes">
          <Textarea id="inv-notes" name="notes" rows={3} placeholder="Internal notes..." />
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Invoice
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
