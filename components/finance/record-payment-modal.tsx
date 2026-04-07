"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup } from "@/components/ui/form-field";
import { formatCurrency } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: unknown;
    client: { name: string };
    payments: { amount: unknown }[];
  };
}

export function RecordPaymentModal({ open, onOpenChange, invoice }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Number(invoice.amount) - totalPaid;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    const body = {
      invoiceId: invoice.id,
      amount: parseFloat(form.get("amount") as string),
      method: form.get("method") as string,
      reference: (form.get("reference") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
    };

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to record payment");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record Payment"
      description={`Invoice ${invoice.invoiceNumber} · ${invoice.client.name} · Remaining: ${formatCurrency(remaining)}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Amount ($)" htmlFor="pay-amount" required>
            <Input
              id="pay-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={remaining > 0 ? remaining.toFixed(2) : ""}
              required
            />
          </FormGroup>
          <FormGroup label="Payment Method" htmlFor="pay-method" required>
            <Select id="pay-method" name="method" required>
              <option value="">Select...</option>
              <option value="CHECK">Check</option>
              <option value="WIRE">Wire Transfer</option>
              <option value="ACH">ACH</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="OTHER">Other</option>
            </Select>
          </FormGroup>
        </div>

        <FormGroup label="Reference #" htmlFor="pay-ref">
          <Input id="pay-ref" name="reference" placeholder="Check number, transaction ID..." />
        </FormGroup>

        <FormGroup label="Notes" htmlFor="pay-notes">
          <Textarea id="pay-notes" name="notes" rows={2} placeholder="Optional notes..." />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Recording..." : "Record Payment"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
