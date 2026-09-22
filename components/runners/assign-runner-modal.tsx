"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Select, FormGroup, FormActions } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";

type Target = { id: string; eventName: string; runnerId: string | null } | null;

/**
 * Pick a runner by hand for one activity (or clear the one it has).
 * A hand-picked runner is never overwritten by the auto-scheduler.
 */
export function AssignRunnerModal({
  assignment,
  runners,
  onClose,
}: {
  assignment: Target;
  runners: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!assignment) return;
    const runnerId = (new FormData(e.currentTarget).get("runnerId") as string) || "";
    setLoading(true);
    try {
      const res = await fetch(`/api/runner-assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runnerId: runnerId || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: typeof body?.error === "string" ? body.error : "Could not assign the runner",
          variant: "error",
        });
        return;
      }
      const name = runners.find((r) => r.id === runnerId)?.name;
      toast({
        title: runnerId ? `Assigned to ${name}` : "Runner cleared",
        variant: "success",
      });
      onClose();
      router.refresh();
    } catch {
      toast({ title: "Network error — please try again", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={!!assignment}
      onOpenChange={(open) => !open && onClose()}
      title="Assign a runner"
      description={assignment?.eventName}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Runner" htmlFor="assign-runner">
          <Select id="assign-runner" name="runnerId" defaultValue={assignment?.runnerId ?? ""}>
            <option value="">— Leave unassigned —</option>
            {(() => {
              const onlyRunners = runners.filter((r) => !r.role || r.role === "RUNNER");
              const team = runners.filter((r) => r.role && r.role !== "RUNNER");
              return (
                <>
                  <optgroup label="Runners">
                    {onlyRunners.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                  </optgroup>
                  {team.length > 0 && (
                    <optgroup label="Equipo (acompaña a veces)">
                      {team.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                    </optgroup>
                  )}
                </>
              );
            })()}
          </Select>
        </FormGroup>
        <p className="text-xs text-ink-muted">
          Picking a runner here marks the activity as hand-scheduled, so the Friday
          auto-assign leaves it alone.
        </p>
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
