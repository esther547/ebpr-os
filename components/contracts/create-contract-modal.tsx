"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: { id: string; name: string }[];
}

export function CreateContractModal({ open, onOpenChange, clients }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const body = {
      clientId: form.get("clientId") as string,
      title: form.get("title") as string,
      startDate: (form.get("startDate") as string) || undefined,
      endDate: (form.get("endDate") as string) || undefined,
      value: form.get("value") ? parseFloat(form.get("value") as string) : undefined,
      notes: (form.get("notes") as string) || undefined,
    };

    let res: Response;
    try {
      res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      toast({ title: "Network error — contract not created", variant: "error" });
      setLoading(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast({ title: apiErrorMessage(data, "Failed to create contract"), variant: "error" });
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    toast({ title: "Contract created", variant: "success" });
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Contract" description="Create a contract for a client">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Client" htmlFor="ct-client" required>
          <Select id="ct-client" name="clientId" required>
            <option value="">Select client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Contract Title" htmlFor="ct-title" required>
          <Input id="ct-title" name="title" placeholder="e.g., 2026 PR Retainer" required autoFocus />
        </FormGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormGroup label="Start Date" htmlFor="ct-start">
            <Input id="ct-start" name="startDate" type="date" />
          </FormGroup>
          <FormGroup label="End Date" htmlFor="ct-end">
            <Input id="ct-end" name="endDate" type="date" />
          </FormGroup>
        </div>

        <FormGroup label="Contract Value ($)" htmlFor="ct-value">
          <Input id="ct-value" name="value" type="number" step="0.01" min="0" placeholder="0.00" />
        </FormGroup>

        <FormGroup label="Notes" htmlFor="ct-notes">
          <Textarea id="ct-notes" name="notes" rows={3} placeholder="Internal notes about this contract..." />
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Contract
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
