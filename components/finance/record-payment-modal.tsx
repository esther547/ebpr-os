"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { apiErrorMessage, localDateInputValue } from "@/components/finance/invoice-status";

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
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Number(invoice.amount) - totalPaid;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const body = {
      invoiceId: invoice.id,
      amount: parseFloat(form.get("amount") as string),
      method: form.get("method") as string,
      reference: (form.get("reference") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
      paidAt: (form.get("paidAt") as string) || undefined,
    };

    let res: Response;
    try {
      res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      toast({ title: "Network error — payment not recorded", variant: "error" });
      setLoading(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast({ title: apiErrorMessage(data, "Failed to record payment"), variant: "error" });
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    toast({ title: "Payment recorded", variant: "success" });
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
        <div className="grid gap-4 sm:grid-cols-2">
          <FormGroup label="Amount ($)" htmlFor="pay-amount" required>
            <Input
              id="pay-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={remaining > 0 ? remaining.toFixed(2) : ""}
              required
            />
          </FormGroup>
          <FormGroup label="Payment Date" htmlFor="pay-date" required>
            <Input id="pay-date" name="paidAt" type="date" defaultValue={localDateInputValue()} required />
          </FormGroup>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <FormGroup label="Reference #" htmlFor="pay-ref">
            <Input id="pay-ref" name="reference" placeholder="Check number, transaction ID..." />
          </FormGroup>
        </div>

        <FormGroup label="Notes" htmlFor="pay-notes">
          <Textarea id="pay-notes" name="notes" rows={2} placeholder="Optional notes..." />
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Record Payment
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
