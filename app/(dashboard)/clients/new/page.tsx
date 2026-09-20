"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/header";
import { Button, Input, Select, FormGroup, FormActions } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      industry: (form.get("industry") as string) || undefined,
      website: (form.get("website") as string) || undefined,
      monthlyTarget: parseInt(form.get("monthlyTarget") as string) || 6,
    };

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = payload.error;
        toast({
          title: "Failed to create client",
          description:
            typeof err === "string"
              ? err
              : err?.fieldErrors?.name?.[0] || err?.fieldErrors?.website?.[0] || undefined,
          variant: "error",
        });
        setLoading(false);
        return;
      }

      router.push(`/clients/${payload.data.id}`);
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: "New" }]}
        title="New Client"
        subtitle="Add a new client to EBPR"
      />
      <div className="mx-auto max-w-xl">
        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormGroup label="Client Name" htmlFor="name" required>
              <Input id="name" name="name" placeholder="e.g., Reykon" required autoFocus />
            </FormGroup>

            <FormGroup label="Industry" htmlFor="industry">
              <Select id="industry" name="industry">
                <option value="">Select industry...</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Music">Music</option>
                <option value="Fashion">Fashion</option>
                <option value="Digital Creator">Digital Creator</option>
                <option value="Influencer">Influencer</option>
                <option value="Reality TV">Reality TV</option>
                <option value="Sports">Sports</option>
                <option value="Beauty">Beauty</option>
                <option value="Lifestyle">Lifestyle</option>
                <option value="Tech">Tech</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Corporate">Corporate</option>
                <option value="Hospitality">Hospitality</option>
                <option value="Other">Other</option>
              </Select>
            </FormGroup>

            <FormGroup label="Website" htmlFor="website">
              <Input id="website" name="website" type="url" placeholder="https://..." />
            </FormGroup>

            <FormGroup
              label="Monthly Deliverables Target"
              htmlFor="monthlyTarget"
              description="EBPR standard is 6–8 deliverables/month"
            >
              <Input id="monthlyTarget" name="monthlyTarget" type="number" min={1} max={30} defaultValue={7} />
            </FormGroup>

            <FormActions>
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Create Client
              </Button>
            </FormActions>
          </form>
        </Card>
      </div>
    </>
  );
}
