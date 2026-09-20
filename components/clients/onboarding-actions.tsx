"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, Input, FormGroup } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";

const STEPS = [
  { key: "NOT_STARTED", label: "Not Started" },
  { key: "KICKOFF_SCHEDULED", label: "Kickoff Scheduled" },
  { key: "KICKOFF_COMPLETE", label: "Kickoff Complete" },
  { key: "QUESTIONNAIRE_SENT", label: "Questionnaire Sent" },
  { key: "QUESTIONNAIRE_RECEIVED", label: "Questionnaire Received" },
  { key: "STRATEGY_IN_PROGRESS", label: "Strategy In Progress" },
  { key: "COMPLETE", label: "Complete" },
];

interface Props {
  clientId: string;
  status: string | null; // null = onboarding record does not exist yet
  kickoffDate: string | Date | null;
}

export function OnboardingActions({ clientId, status, kickoffDate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIdx = status ? STEPS.findIndex((s) => s.key === status) : -1;
  const next = currentIdx >= 0 && currentIdx < STEPS.length - 1 ? STEPS[currentIdx + 1] : null;

  async function save(body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Could not update onboarding");
        setLoading(false);
        return false;
      }
      setLoading(false);
      router.refresh();
      return true;
    } catch {
      setError("Network error — could not reach the server");
      setLoading(false);
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const ok = await save({
      status: form.get("status") as string,
      kickoffDate: (form.get("kickoffDate") as string) || null,
    });
    if (ok) setOpen(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {error && <span className="text-xs text-red-600" role="alert">{error}</span>}
        {status === null ? (
          <Button onClick={() => save({ status: "KICKOFF_SCHEDULED" })} disabled={loading}>
            {loading ? "Starting..." : "Start Onboarding"}
          </Button>
        ) : (
          <>
            {next && (
              <Button onClick={() => save({ status: next.key })} disabled={loading}>
                {loading ? "Saving..." : `Mark "${next.label}"`}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Edit Status
            </Button>
          </>
        )}
      </div>

      <Modal open={open} onOpenChange={setOpen} title="Edit Onboarding" description="Set the current step and kickoff date">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormGroup label="Status" htmlFor="ob-status" required>
            <Select id="ob-status" name="status" defaultValue={status ?? "NOT_STARTED"} required>
              {STEPS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Kickoff Date" htmlFor="ob-kickoff">
            <Input
              id="ob-kickoff"
              name="kickoffDate"
              type="date"
              defaultValue={kickoffDate ? new Date(kickoffDate).toISOString().slice(0, 10) : ""}
            />
          </FormGroup>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
