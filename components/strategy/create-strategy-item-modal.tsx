"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup } from "@/components/ui/form-field";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

export function CreateStrategyItemModal({ open, onOpenChange, clientId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    const items = [{
      title: form.get("title") as string,
      category: form.get("category") as string,
      targetName: (form.get("targetName") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
      isBigWin: form.get("isBigWin") === "true",
      phase: form.get("phase") ? parseInt(form.get("phase") as string) : undefined,
    }];

    const res = await fetch(`/api/clients/${clientId}/strategy/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create strategy item");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add Strategy Item" description="Add to the strategy wishlist">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <FormGroup label="Title" htmlFor="si-title" required>
          <Input id="si-title" name="title" placeholder="e.g., Vogue Latin America Feature" required autoFocus />
        </FormGroup>

        <FormGroup label="Category" htmlFor="si-category" required>
          <Select id="si-category" name="category" required>
            <option value="">Select category...</option>
            <option value="MEDIA_TARGET">Media Target</option>
            <option value="INFLUENCER">Influencer</option>
            <option value="EVENT">Event</option>
            <option value="BRAND_OPPORTUNITY">Brand Opportunity</option>
            <option value="POSITIONING">Positioning</option>
            <option value="OTHER">Other</option>
          </Select>
        </FormGroup>

        <FormGroup label="Target Name" htmlFor="si-target">
          <Input id="si-target" name="targetName" placeholder="e.g., Vogue, Rolling Stone, Billboard" />
        </FormGroup>

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Phase" htmlFor="si-phase">
            <Select id="si-phase" name="phase">
              <option value="">Any</option>
              <option value="1">Phase 1</option>
              <option value="2">Phase 2</option>
            </Select>
          </FormGroup>

          <FormGroup label="Big Win?" htmlFor="si-bigwin">
            <Select id="si-bigwin" name="isBigWin">
              <option value="false">No</option>
              <option value="true">Yes — Top Priority</option>
            </Select>
          </FormGroup>
        </div>

        <FormGroup label="Notes" htmlFor="si-notes">
          <Textarea id="si-notes" name="notes" rows={3} placeholder="Context, angles, contacts..." />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Adding..." : "Add Item"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
