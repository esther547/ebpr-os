"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Plus } from "lucide-react";
import { Button, Input, FormGroup, FormActions } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, Th, Td } from "@/components/ui/table";
import { SectionHeader } from "@/components/layout/header";
import { useToast } from "@/components/ui/toast";
import { formatDayKey } from "@/components/runners/miami-time";

type HourEntry = {
  id: string;
  date: string;
  /** "yyyy-MM-dd" in Miami time, computed on the server. */
  dayKey: string;
  hours: number;
  description: string | null;
  clientName: string | null;
};

export function RunnerHoursClient({
  hours,
  totalHours,
  todayKey,
}: {
  hours: HourEntry[];
  totalHours: number;
  /** Today, "yyyy-MM-dd" (Miami). */
  todayKey: string;
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label="Hours this month"
          value={`${totalHours}h`}
          hint={`${hours.length} entr${hours.length === 1 ? "y" : "ies"} logged`}
          icon={<Clock />}
        />
        <div className="flex items-center sm:justify-end">
          <Button
            size="lg"
            onClick={() => setShowAdd(true)}
            leftIcon={<Plus className="h-4 w-4" />}
            className="h-12 w-full sm:h-10 sm:w-auto"
          >
            Log Hours
          </Button>
        </div>
      </div>

      {hours.length > 0 && (
        <div>
          <SectionHeader title="Logged hours" />
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-auto">
              <Table className="min-w-[520px]">
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th align="right">Hours</Th>
                    <Th>Job</Th>
                    <Th>Description</Th>
                  </tr>
                </thead>
                <tbody>
                  {hours.map((h) => (
                    <tr key={h.id}>
                      <Td className="whitespace-nowrap text-ink-secondary">
                        {formatDayKey(h.dayKey, "MMM d, yyyy")}
                      </Td>
                      <Td align="right" numeric className="font-medium">
                        {h.hours}h
                      </Td>
                      <Td className="text-ink-secondary">{h.clientName || "—"}</Td>
                      <Td className="text-ink-muted">{h.description || "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      <LogHoursModal open={showAdd} onOpenChange={setShowAdd} todayKey={todayKey} />
    </div>
  );
}

function LogHoursModal({
  open,
  onOpenChange,
  todayKey,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  todayKey: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const hoursValue = parseFloat(form.get("hours") as string);
    if (!Number.isFinite(hoursValue) || hoursValue <= 0) {
      toast({ title: "Please enter a valid number of hours", variant: "error" });
      setLoading(false);
      return;
    }
    const body = {
      date: form.get("date") as string,
      hours: hoursValue,
      clientName: ((form.get("clientName") as string) || "").trim() || undefined,
      description: ((form.get("description") as string) || "").trim() || undefined,
    };

    try {
      const res = await fetch("/api/runner-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = data?.error;
        toast({
          title:
            typeof err === "string"
              ? err
              : err && typeof err === "object"
                ? Object.values(err as Record<string, string[]>).flat().join(", ")
                : "Failed to log hours",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      onOpenChange(false);
      setLoading(false);
      toast({ title: "Hours logged", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Network error — please try again", variant: "error" });
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Log Hours" description="Record hours for a job">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Date" htmlFor="rh-date" required>
            <Input id="rh-date" name="date" type="date" required defaultValue={todayKey} max={todayKey} />
          </FormGroup>
          <FormGroup label="Hours" htmlFor="rh-hours" required>
            <Input
              id="rh-hours"
              name="hours"
              type="number"
              inputMode="decimal"
              step="0.25"
              min="0.25"
              max="24"
              required
              placeholder="e.g., 3.5"
            />
          </FormGroup>
        </div>

        <FormGroup label="Job / Client" htmlFor="rh-client">
          <Input id="rh-client" name="clientName" placeholder="e.g., Reykon — Red Carpet" />
        </FormGroup>

        <FormGroup label="Description" htmlFor="rh-desc">
          <Input id="rh-desc" name="description" placeholder="What did you do?" />
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Log Hours
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
