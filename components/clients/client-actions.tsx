"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, FormGroup, FormActions } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Settings2, Pause, Play } from "lucide-react";

interface Props {
  clientId: string;
  clientName: string;
  industry?: string | null;
  monthlyTarget: number;
  cycleDay: number | null;
  goalsOwed?: number;
  focusNote?: string | null;
  agendaDocUrl?: string | null;
  status: string;
}

export function ClientActions({ clientId, clientName, industry, monthlyTarget, cycleDay, goalsOwed, focusNote, agendaDocUrl, status }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const [toggling, setToggling] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function toggleStatus() {
    const newStatus = status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setToggling(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Could not change status",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        return;
      }
      toast({
        title: newStatus === "PAUSED" ? "Client paused" : "Client reactivated",
        variant: "success",
      });
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
    } finally {
      setToggling(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowEdit(true)}
        leftIcon={<Settings2 className="h-3.5 w-3.5" />}
        title="Edit client settings"
      >
        Edit
      </Button>

      {status === "ACTIVE" ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleStatus}
          loading={toggling}
          leftIcon={<Pause className="h-3.5 w-3.5" />}
          title="Pause client"
        >
          Pause
        </Button>
      ) : status === "PAUSED" ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleStatus}
          loading={toggling}
          leftIcon={<Play className="h-3.5 w-3.5" />}
          title="Reactivate client"
        >
          Reactivate
        </Button>
      ) : null}

      <EditClientModal
        open={showEdit}
        onOpenChange={setShowEdit}
        clientId={clientId}
        clientName={clientName}
        industry={industry ?? ""}
        monthlyTarget={monthlyTarget}
        cycleDay={cycleDay ?? null}
        goalsOwed={goalsOwed ?? 0}
        focusNote={focusNote ?? ""}
        agendaDocUrl={agendaDocUrl ?? ""}
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
  industry,
  monthlyTarget,
  cycleDay,
  goalsOwed,
  focusNote,
  agendaDocUrl,
  status,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  clientName: string;
  industry: string;
  monthlyTarget: number;
  cycleDay: number | null;
  goalsOwed: number;
  focusNote: string;
  agendaDocUrl: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      industry: ((form.get("industry") as string) || "").trim() || null,
      monthlyTarget: parseInt(form.get("monthlyTarget") as string),
      cycleDay: (form.get("cycleDay") as string) ? parseInt(form.get("cycleDay") as string) : null,
      goalsOwed: parseInt((form.get("goalsOwed") as string) || "0") || 0,
      focusNote: ((form.get("focusNote") as string) || "").trim() || null,
      agendaDocUrl: ((form.get("agendaDocUrl") as string) || "").trim() || null,
      status: form.get("status") as string,
    };

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Failed to update client",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        setLoading(false);
        return;
      }

      onOpenChange(false);
      setLoading(false);
      toast({ title: "Client updated", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit Client" description={clientName}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Client Name" htmlFor="ec-name" required>
          <Input id="ec-name" name="name" defaultValue={clientName} required />
        </FormGroup>

        <FormGroup label="Industry" htmlFor="ec-industry">
          <Input id="ec-industry" name="industry" defaultValue={industry} placeholder="e.g., Music" />
        </FormGroup>

        <FormGroup label="Monthly Deliverables" htmlFor="ec-target" required>
          <Select id="ec-target" name="monthlyTarget" defaultValue={monthlyTarget.toString()} required>
            <option value="0">Preparation month (no target yet)</option>
            <option value="2">2 deliverables/month</option>
            <option value="4">4 deliverables/month</option>
            <option value="5">5 deliverables/month</option>
            <option value="6">6 deliverables/month</option>
            <option value="7">7 deliverables/month</option>
            <option value="8">8 deliverables/month</option>
            <option value="10">10 deliverables/month</option>
            <option value="12">12 deliverables/month</option>
            <option value="15">15 deliverables/month</option>
          </Select>
        </FormGroup>

        <FormGroup label="Cycle reset day" htmlFor="ec-cycle" hint="fecha de corte" description="Day of the month the client's deliverable count restarts (1-31). Leave blank if unknown.">
          <Input id="ec-cycle" name="cycleDay" type="number" min={1} max={31} defaultValue={cycleDay ?? ""} placeholder="e.g. 15" />
        </FormGroup>

        <FormGroup label="Goals owed" htmlFor="ec-owed" hint="metas atrasadas" description="Goals still owed from previous cycles.">
          <Input id="ec-owed" name="goalsOwed" type="number" min={0} defaultValue={goalsOwed} />
        </FormGroup>

        <FormGroup label="Focus this cycle" htmlFor="ec-focus" description="What the team should close next, e.g. 'Septiembre: 3 metas'.">
          <Input id="ec-focus" name="focusNote" defaultValue={focusNote} placeholder="e.g. Septiembre: 3 metas" />
        </FormGroup>

        <FormGroup label="Agenda Google Doc" htmlFor="ec-agenda">
          <Input id="ec-agenda" name="agendaDocUrl" type="url" defaultValue={agendaDocUrl} placeholder="https://docs.google.com/document/d/..." />
        </FormGroup>

        <FormGroup label="Status" htmlFor="ec-status" required>
          <Select id="ec-status" name="status" defaultValue={status} required>
            <option value="PROSPECT">Prospect</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused (Not Active)</option>
            <option value="CHURNED">Churned</option>
          </Select>
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save Changes
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
