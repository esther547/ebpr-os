"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  teamMembers: { id: string; name: string }[];
}

export function CreateCampaignModal({ open, onOpenChange, clientId, teamMembers }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const body = {
      clientId,
      name: form.get("name") as string,
      description: (form.get("description") as string) || undefined,
      startDate: (form.get("startDate") as string) || undefined,
      endDate: (form.get("endDate") as string) || undefined,
      ownerId: (form.get("ownerId") as string) || undefined,
      monthlyTarget: parseInt(form.get("monthlyTarget") as string) || 7,
    };

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      toast({
        title: "Failed to create campaign",
        description: typeof data.error === "string" ? data.error : undefined,
        variant: "error",
      });
      setLoading(false);
      return;
    }

    onOpenChange(false);
    setLoading(false);
    toast({ title: "Campaign created", variant: "success" });
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New Campaign">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Campaign Name" htmlFor="camp-name" required>
          <Input id="camp-name" name="name" placeholder="e.g., 2026 Summer Campaign" required autoFocus />
        </FormGroup>

        <FormGroup label="Description" htmlFor="camp-desc">
          <Textarea id="camp-desc" name="description" rows={2} placeholder="Campaign objectives..." />
        </FormGroup>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Start Date" htmlFor="camp-start">
            <Input id="camp-start" name="startDate" type="date" />
          </FormGroup>
          <FormGroup label="End Date" htmlFor="camp-end">
            <Input id="camp-end" name="endDate" type="date" />
          </FormGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Lead Strategist" htmlFor="camp-owner">
            <Select id="camp-owner" name="ownerId">
              <option value="">Select lead...</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup label="Monthly Target" htmlFor="camp-target">
            <Input id="camp-target" name="monthlyTarget" type="number" min={1} max={30} defaultValue={7} />
          </FormGroup>
        </div>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Campaign
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
