"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/header";
import { Button, Input, Textarea, Select, FormGroup } from "@/components/ui/form-field";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      industry: form.get("industry") as string || undefined,
      website: form.get("website") as string || undefined,
      monthlyTarget: parseInt(form.get("monthlyTarget") as string) || 6,
    };

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.fieldErrors?.name?.[0] || data.error || "Failed to create client");
      setLoading(false);
      return;
    }

    const { data } = await res.json();
    router.push(`/clients/${data.id}`);
  }

  return (
    <>
      <PageHeader title="New Client" subtitle="Add a new client to EBPR" />
      <div className="mx-auto max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-white p-6">
          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <FormGroup label="Client Name" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              placeholder="e.g., Reykon"
              required
              autoFocus
            />
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
            <Input
              id="website"
              name="website"
              type="url"
              placeholder="https://..."
            />
          </FormGroup>

          <FormGroup label="Monthly Deliverables Target" htmlFor="monthlyTarget">
            <Input
              id="monthlyTarget"
              name="monthlyTarget"
              type="number"
              min={1}
              max={30}
              defaultValue={7}
            />
            <p className="text-xs text-ink-muted mt-1">
              EBPR standard is 6-8 deliverables/month
            </p>
          </FormGroup>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Client"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
