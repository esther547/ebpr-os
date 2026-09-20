"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MapPin, Clock, User, FileText, Check, Briefcase } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button, Textarea, FormGroup } from "@/components/ui/form-field";
import { addDaysKey, formatDayKey, formatInTz } from "@/components/runners/miami-time";

export type ScheduleItem = {
  id: string;
  eventName: string;
  eventDate: string;
  /** "yyyy-MM-dd" in Miami time, computed on the server. */
  dayKey: string;
  arrivalTime: string | null;
  eventTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  itemType: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  accompanistCount: number;
  /** Display name only — runners never receive client IDs. */
  clientName: string | null;
  runner?: { id: string; name: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700",
  CONFIRMED: "bg-green-50 text-green-700",
  COMPLETED: "bg-surface-2 text-ink-muted",
};

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

export function MyScheduleView({
  assignments,
  todayKey,
  showRunner = false,
}: {
  assignments: ScheduleItem[];
  /** Today, "yyyy-MM-dd" (Miami). */
  todayKey: string;
  /** Show the runner's name on each card (internal views only). */
  showRunner?: boolean;
}) {
  const [completeAssignment, setCompleteAssignment] = useState<ScheduleItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-medium text-ink-primary">No upcoming assignments</p>
        <p className="mt-1 text-sm text-ink-muted">You&apos;re all caught up!</p>
      </div>
    );
  }

  async function markCompleted(id: string, notes?: string): Promise<boolean> {
    setError(null);
    try {
      const res = await fetch(`/api/runner-assignments/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data?.error === "string" ? data.error : "Could not mark as completed");
        return false;
      }
      setCompleteAssignment(null);
      router.refresh();
      return true;
    } catch {
      setError("Network error — please try again");
      return false;
    }
  }

  // Group by Miami calendar day (same key the server used)
  const grouped = new Map<string, ScheduleItem[]>();
  for (const a of assignments) {
    const arr = grouped.get(a.dayKey) ?? [];
    arr.push(a);
    grouped.set(a.dayKey, arr);
  }
  const tomorrowKey = addDaysKey(todayKey, 1);

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([dateKey, items]) => {
          const dayLabel =
            dateKey === todayKey
              ? "Today"
              : dateKey === tomorrowKey
                ? "Tomorrow"
                : dateKey < todayKey
                  ? `${formatDayKey(dateKey, "EEEE, MMMM d")} · Pending completion`
                  : formatDayKey(dateKey, "EEEE, MMMM d");

          return (
            <div key={dateKey}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
                {dayLabel}
              </h3>
              <div className="space-y-3">
                {items.map((a) => (
                  <div
                    key={a.id}
                    id={`assignment-${a.id}`}
                    className="rounded-lg border border-border bg-white p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-ink-primary truncate">{a.eventName}</h4>
                          <span className={cn("rounded-full px-2 py-0.5 text-2xs font-medium flex-shrink-0", STATUS_STYLES[a.status] || "bg-surface-2 text-ink-secondary")}>
                            {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {a.clientName && (
                            <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-2xs font-medium text-ink-primary">
                              <Briefcase className="h-3 w-3 text-ink-muted" />
                              {a.clientName}
                            </span>
                          )}
                          {a.itemType && (
                            <span className="inline-block rounded bg-surface-2 px-2 py-0.5 text-2xs font-medium text-ink-secondary">
                              {a.itemType}
                            </span>
                          )}
                          {showRunner && a.runner && (
                            <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-2xs font-medium text-ink-secondary">
                              <User className="h-3 w-3 text-ink-muted" />
                              {a.runner.name}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-secondary mt-1">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-ink-muted" />
                            {a.arrivalTime && (
                              <span>Arrive {formatInTz(a.arrivalTime, TIME)}</span>
                            )}
                            {a.eventTime ? (
                              <span className="font-medium">
                                {a.arrivalTime ? "· " : ""}On Air {formatInTz(a.eventTime, TIME)}
                              </span>
                            ) : !a.arrivalTime ? (
                              <span>{formatInTz(a.eventDate, TIME)}</span>
                            ) : null}
                          </div>
                          {(a.venueName || a.location) && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-ink-muted" />
                              <span>
                                {a.venueName}
                                {a.venueName && a.location ? " · " : ""}
                                {a.location}
                              </span>
                            </div>
                          )}
                          {a.accompanistCount > 0 && (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-ink-muted" />
                              <span>{a.accompanistCount} accompanist{a.accompanistCount > 1 ? "s" : ""}</span>
                            </div>
                          )}
                        </div>

                        {a.venueAddress && (
                          <p className="text-xs text-ink-muted mt-1">{a.venueAddress}</p>
                        )}

                        {a.notes && (
                          <div className="flex items-start gap-1.5 mt-2 text-xs text-ink-secondary">
                            <FileText className="h-3 w-3 text-ink-muted mt-0.5 flex-shrink-0" />
                            <span className="whitespace-pre-line">{a.notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons for runners */}
                      {a.status !== "COMPLETED" && a.status !== "CANCELLED" && (
                        <div className="flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setCompleteAssignment(a)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
                          >
                            <Check className="h-3 w-3" />
                            Complete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Complete Assignment Modal */}
      {completeAssignment && (
        <CompleteModal
          open={!!completeAssignment}
          onOpenChange={(o) => { if (!o) setCompleteAssignment(null); }}
          assignment={completeAssignment}
          onComplete={markCompleted}
        />
      )}
    </>
  );
}

function CompleteModal({
  open,
  onOpenChange,
  assignment,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignment: ScheduleItem;
  onComplete: (id: string, notes?: string) => Promise<boolean>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const notes = ((form.get("notes") as string) || "").trim() || undefined;
    const ok = await onComplete(assignment.id, notes);
    if (!ok) setLoading(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Mark as Completed" description={assignment.eventName}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Post-Event Notes (optional)" htmlFor="comp-notes">
          <Textarea id="comp-notes" name="notes" rows={4} placeholder="Any feedback, issues, or wins from this event..." />
        </FormGroup>
        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Completing..." : "Mark Completed"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
