"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Select, FormGroup, FormActions } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";

/** One pauta of an event (one per client). */
export type AssignMember = { id: string; clientName?: string | null; runnerId: string | null };
type Target = { id: string; eventName: string; runnerId: string | null; clientName?: string | null; coClients?: string[]; members?: AssignMember[] } | null;
type RunnerOption = { id: string; name: string; role?: string };

function RunnerSelect({ id, name, value, onChange, runners }: { id: string; name?: string; value: string; onChange: (v: string) => void; runners: RunnerOption[] }) {
  const onlyRunners = runners.filter((r) => !r.role || r.role === "RUNNER");
  const team = runners.filter((r) => r.role && r.role !== "RUNNER");
  return (
    <Select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Sin runner —</option>
      <optgroup label="Runners">{onlyRunners.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}</optgroup>
      {team.length > 0 && <optgroup label="Equipo (acompaña a veces)">{team.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}</optgroup>}
    </Select>
  );
}

/**
 * Pick a runner by hand for one activity (or clear the one it has). For an event with several clients,
 * one runner per client: the same for all with one click, or different ones (Esther, Oct 12 2026).
 * A hand-picked runner is never overwritten by the auto-scheduler.
 */
export function AssignRunnerModal({ assignment, runners, onClose }: { assignment: Target; runners: RunnerOption[]; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const members: AssignMember[] = assignment?.members && assignment.members.length > 1 ? assignment.members : assignment ? [{ id: assignment.id, clientName: assignment.clientName ?? null, runnerId: assignment.runnerId }] : [];
  const [picks, setPicks] = useState<Record<string, string>>({});
  useEffect(() => { setPicks(Object.fromEntries(members.map((m) => [m.id, m.runnerId ?? ""]))); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment?.id]);
  const multi = members.length > 1;
  const setAll = (v: string) => setPicks(Object.fromEntries(members.map((m) => [m.id, v])));
  const allSame = multi && new Set(Object.values(picks)).size === 1 ? Object.values(picks)[0] ?? "" : "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!assignment) return;
    setLoading(true);
    try {
      let failed = 0;
      for (const m of members) {
        const runnerId = picks[m.id] ?? "";
        if (runnerId === (m.runnerId ?? "")) continue;
        const res = await fetch(`/api/runner-assignments/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runnerId: runnerId || null }) });
        if (!res.ok) { failed++; const body = await res.json().catch(() => ({})); toast({ title: `${m.clientName ?? "Pauta"}: ${typeof body?.error === "string" ? body.error : "no se pudo asignar"}`, variant: "error" }); }
      }
      if (failed < members.length) {
        const names = Array.from(new Set(members.map((m) => runners.find((r) => r.id === picks[m.id])?.name).filter(Boolean)));
        toast({ title: multi ? `Runners asignados a ${members.length} clientes` : names[0] ? `Assigned to ${names[0]}` : "Runner cleared", description: multi ? members.map((m) => `${m.clientName ?? "?"}: ${runners.find((r) => r.id === picks[m.id])?.name?.split(" ")[0] ?? "sin runner"}`).join(" · ") : undefined, variant: "success" });
        onClose();
        router.refresh();
      }
    } catch {
      toast({ title: "Network error — please try again", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!assignment} onOpenChange={(open) => !open && onClose()} title={multi ? `Runners para ${members.length} clientes` : "Assign a runner"} description={assignment?.eventName} size={multi ? "md" : "sm"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {multi ? (
          <>
            <FormGroup label="Mismo runner para todos" htmlFor="assign-all" description="Elige uno aquí y luego cambia el de algún cliente si hace falta.">
              <RunnerSelect id="assign-all" value={allSame} onChange={setAll} runners={runners} />
            </FormGroup>
            <div className="divide-y divide-border rounded-lg border border-border">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-primary">{m.clientName ?? "Cliente"}</span>
                  <div className="w-52"><RunnerSelect id={`assign-${m.id}`} value={picks[m.id] ?? ""} onChange={(v) => setPicks({ ...picks, [m.id]: v })} runners={runners} /></div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <FormGroup label="Runner" htmlFor="assign-runner">
            <RunnerSelect id="assign-runner" name="runnerId" value={picks[members[0]?.id] ?? ""} onChange={(v) => members[0] && setPicks({ [members[0].id]: v })} runners={runners} />
          </FormGroup>
        )}
        <p className="text-xs text-ink-muted">Picking a runner here marks the activity as hand-scheduled, so the Friday auto-assign leaves it alone.</p>
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Save</Button>
        </FormActions>
      </form>
    </Modal>
  );
}
