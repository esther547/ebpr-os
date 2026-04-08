"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, FormGroup } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { Settings2, Pause, Play } from "lucide-react";

interface Props {
  clientId: string;
  clientName: string;
  monthlyTarget: number;
  status: string;
}

export function ClientActions({ clientId, clientName, monthlyTarget, status }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const router = useRouter();

  async function toggleStatus() {
    const newStatus = status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await fetch(`/api/clients/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setShowEdit(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-sm font-medium text-ink-secondary hover:bg-surface-2 transition-colors"
        title="Edit client settings"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>

      {status === "ACTIVE" ? (
        <button
          onClick={toggleStatus}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          title="Pause client"
        >
          <Pause className="h-3.5 w-3.5" />
          Pause
        </button>
      ) : status === "PAUSED" ? (
        <button
          onClick={toggleStatus}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
          title="Reactivate client"
        >
          <Play className="h-3.5 w-3.5" />
          Reactivate
        </button>
      ) : null}

      <EditClientModal
        open={showEdit}
        onOpenChange={setShowEdit}
        clientId={clientId}
        clientName={clientName}
        monthlyTarget={monthlyTarget}
        status={status}
      />
    </>
  );
}

function EditClientModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  monthlyTarget,
  status,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  clientName: string;
  monthlyTarget: number;
  status: string;
}) {
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
      industry: (form.get("industry") as string) || undefined,
      monthlyTarget: parseInt(form.get("monthlyTarget") as string),
      status: form.get("status") as string,
    };

    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError("Failed to update client");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit Client" description={clientName}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <FormGroup label="Client Name" htmlFor="ec-name" required>
          <Input id="ec-name" name="name" defaultValue={clientName} required />
        </FormGroup>

        <FormGroup label="Industry" htmlFor="ec-industry">
          <Input id="ec-industry" name="industry" />
        </FormGroup>

        <FormGroup label="Monthly Deliverables" htmlFor="ec-target" required>
          <Select id="ec-target" name="monthlyTarget" defaultValue={monthlyTarget.toString()} required>
            <option value="2">2 deliverables/month</option>
            <option value="4">4 deliverables/month</option>
            <option value="6">6 deliverables/month</option>
            <option value="7">7 deliverables/month</option>
            <option value="8">8 deliverables/month</option>
            <option value="10">10 deliverables/month</option>
            <option value="12">12 deliverables/month</option>
            <option value="15">15 deliverables/month</option>
          </Select>
        </FormGroup>

        <FormGroup label="Status" htmlFor="ec-status" required>
          <Select id="ec-status" name="status" defaultValue={status} required>
            <option value="PROSPECT">Prospect</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused (Not Active)</option>
            <option value="CHURNED">Churned</option>
          </Select>
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
