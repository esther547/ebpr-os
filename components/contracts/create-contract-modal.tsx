"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup } from "@/components/ui/form-field";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: { id: string; name: string }[];
}

export function CreateContractModal({ open, onOpenChange, clients }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    const body = {
      clientId: form.get("clientId") as string,
      title: form.get("title") as string,
      startDate: (form.get("startDate") as string) || undefined,
      endDate: (form.get("endDate") as string) || undefined,
      value: form.get("value") ? parseFloat(form.get("value") as string) : undefined,
      notes: (form.get("notes") as string) || undefined,
    };

    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create contract");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Contract" description="Create a contract for a client">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

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

        <div className="grid grid-cols-2 gap-4">
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

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Contract"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
