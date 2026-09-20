"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, Input, Select } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { formatDayKey } from "@/components/runners/miami-time";
import { cn } from "@/lib/utils";

export type WeeklyWindow = { dayOfWeek: number; start: string; end: string };
export type DateOverride = {
  id: string;
  /** "yyyy-MM-dd" (Miami). */
  date: string;
  isAvailable: boolean;
  notes: string | null;
};

/** Monday-first, which is how the agency reads a week. */
const DAYS: { dow: number; label: string }[] = [
  { dow: 1, label: "Monday" },
  { dow: 2, label: "Tuesday" },
  { dow: 3, label: "Wednesday" },
  { dow: 4, label: "Thursday" },
  { dow: 5, label: "Friday" },
  { dow: 6, label: "Saturday" },
  { dow: 0, label: "Sunday" },
];

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

type DayState = { enabled: boolean; start: string; end: string };

/**
 * One window per day, which is all the agency needs today. If a runner somehow
 * has several windows on a day, the editor shows the full span (earliest start
 * to latest end) so saving never silently shrinks their availability.
 */
function toDayState(windows: WeeklyWindow[]): Record<number, DayState> {
  const state: Record<number, DayState> = {};
  for (const { dow } of DAYS) {
    const forDay = windows.filter((w) => w.dayOfWeek === dow);
    state[dow] = forDay.length
      ? {
          enabled: true,
          start: forDay.map((w) => w.start).sort()[0],
          end: forDay.map((w) => w.end).sort().reverse()[0],
        }
      : { enabled: false, start: DEFAULT_START, end: DEFAULT_END };
  }
  return state;
}

export function WeeklyAvailabilityEditor({
  userId,
  title,
  description,
  initialWindows,
  initialOverrides,
  canEditOverrides = true,
}: {
  userId: string;
  title: string;
  description?: string;
  initialWindows: WeeklyWindow[];
  initialOverrides: DateOverride[];
  canEditOverrides?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [days, setDays] = useState<Record<number, DayState>>(() => toDayState(initialWindows));
  const [overrides, setOverrides] = useState<DateOverride[]>(initialOverrides);
  const [saving, setSaving] = useState(false);
  const [addingDate, setAddingDate] = useState("");
  const [addingKind, setAddingKind] = useState("unavailable");
  const [adding, setAdding] = useState(false);

  const enabledCount = useMemo(
    () => DAYS.filter(({ dow }) => days[dow]?.enabled).length,
    [days]
  );

  function update(dow: number, patch: Partial<DayState>) {
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], ...patch } }));
  }

  async function save() {
    const windows: WeeklyWindow[] = [];
    for (const { dow, label } of DAYS) {
      const d = days[dow];
      if (!d.enabled) continue;
      if (!d.start || !d.end || d.end <= d.start) {
        toast({ title: `${label}: the end time must be after the start`, variant: "error" });
        return;
      }
      windows.push({ dayOfWeek: dow, start: d.start, end: d.end });
    }

    setSaving(true);
    try {
      const res = await fetch("/api/runner-availability/weekly", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, windows }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: typeof body?.error === "string" ? body.error : "Could not save availability",
          variant: "error",
        });
        return;
      }
      toast({
        title: windows.length ? "Availability saved" : "Marked as never available",
        description: windows.length
          ? `${windows.length} day${windows.length === 1 ? "" : "s"} a week`
          : "This runner will not be auto-assigned.",
        variant: "success",
      });
      router.refresh();
    } catch {
      toast({ title: "Network error — please try again", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function addOverride() {
    if (!addingDate) {
      toast({ title: "Pick a date first", variant: "error" });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/runner-availability/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          date: addingDate,
          isAvailable: addingKind === "available",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: typeof body?.error === "string" ? body.error : "Could not save the date",
          variant: "error",
        });
        return;
      }
      const row = body.data as DateOverride;
      setOverrides((prev) => [...prev.filter((o) => o.date !== row.date), row].sort((a, b) => a.date.localeCompare(b.date)));
      setAddingDate("");
      toast({ title: "Date saved", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Network error — please try again", variant: "error" });
    } finally {
      setAdding(false);
    }
  }

  async function removeOverride(id: string) {
    const previous = overrides;
    setOverrides((prev) => prev.filter((o) => o.id !== id));
    try {
      const res = await fetch(`/api/runner-availability/overrides?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        setOverrides(previous);
        toast({ title: "Could not remove the date", variant: "error" });
        return;
      }
      router.refresh();
    } catch {
      setOverrides(previous);
      toast({ title: "Network error — please try again", variant: "error" });
    }
  }

  return (
    <Card>
      <CardHeader
        title={title}
        description={
          description ??
          (enabledCount === 0
            ? "No weekly availability — never auto-assigned"
            : `Available ${enabledCount} day${enabledCount === 1 ? "" : "s"} a week`)
        }
        actions={
          <Button size="sm" loading={saving} onClick={() => void save()}>
            Save
          </Button>
        }
      />

      <div className="space-y-1.5">
        {DAYS.map(({ dow, label }) => {
          const d = days[dow];
          return (
            <div
              key={dow}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2",
                d.enabled ? "border-border bg-surface-1" : "border-dashed border-border bg-white"
              )}
            >
              <label className="flex w-32 shrink-0 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={d.enabled}
                  onChange={(e) => update(dow, { enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-border accent-ink-primary"
                />
                <span className={d.enabled ? "font-medium text-ink-primary" : "text-ink-muted"}>
                  {label}
                </span>
              </label>

              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label={`${label} start time`}
                  value={d.start}
                  disabled={!d.enabled}
                  onChange={(e) => update(dow, { start: e.target.value })}
                  className="w-32"
                />
                <span className="text-xs text-ink-muted">to</span>
                <Input
                  type="time"
                  aria-label={`${label} end time`}
                  value={d.end}
                  disabled={!d.enabled}
                  onChange={(e) => update(dow, { end: e.target.value })}
                  className="w-32"
                />
              </div>

              {!d.enabled && <span className="text-xs text-ink-muted">Not available</span>}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Times are Miami time. A runner with no days ticked is never auto-assigned.
      </p>

      {/* ── Date overrides ─────────────────────────────────── */}
      <div className="mt-6 border-t border-border pt-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-ink-muted" />
          <h4 className="text-sm font-semibold text-ink-primary">Specific dates</h4>
        </div>

        {overrides.length === 0 ? (
          <p className="text-xs text-ink-muted">
            No exceptions. Add a date to override the weekly pattern.
          </p>
        ) : (
          <ul className="mb-3 space-y-1.5">
            {overrides.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2"
              >
                <span className="text-sm text-ink-primary">
                  {formatDayKey(o.date, "EEE, MMM d, yyyy")}
                </span>
                <div className="flex items-center gap-2">
                  <Badge tone={o.isAvailable ? "success" : "danger"} size="xs" dot>
                    {o.isAvailable ? "Available" : "Unavailable"}
                  </Badge>
                  {canEditOverrides && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove this date"
                      onClick={() => void removeOverride(o.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canEditOverrides && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="Date"
              value={addingDate}
              onChange={(e) => setAddingDate(e.target.value)}
              className="w-44"
            />
            <Select
              aria-label="Availability on that date"
              value={addingKind}
              onChange={(e) => setAddingKind(e.target.value)}
              className="w-40"
            >
              <option value="unavailable">Unavailable</option>
              <option value="available">Available</option>
            </Select>
            <Button variant="secondary" size="sm" loading={adding} onClick={() => void addOverride()}>
              Add date
            </Button>
          </div>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          A date marked unavailable takes the runner out of the schedule for that whole day.
        </p>
      </div>
    </Card>
  );
}
