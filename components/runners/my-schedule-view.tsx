"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { MapPin, Clock, User, FileText, Check, MessageSquare } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button, Textarea, FormGroup } from "@/components/ui/form-field";

type Assignment = {
  id: string;
  eventName: string;
  eventDate: string | Date;
  arrivalTime: string | Date | null;
  eventTime: string | Date | null;
  venueName: string | null;
  venueAddress: string | null;
  itemType: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  accompanistCount: number;
  deliverableId: string | null;
  runner: { id: string; name: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700",
  CONFIRMED: "bg-green-50 text-green-700",
  COMPLETED: "bg-surface-2 text-ink-muted",
};

export function MyScheduleView({ assignments, showActions = false }: { assignments: Assignment[]; showActions?: boolean }) {
  const [completeAssignment, setCompleteAssignment] = useState<Assignment | null>(null);
  const router = useRouter();

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-medium text-ink-primary">No upcoming assignments</p>
        <p className="mt-1 text-sm text-ink-muted">You&apos;re all caught up!</p>
      </div>
    );
  }

  async function markCompleted(id: string, notes?: string) {
    await fetch(`/api/runner-assignments/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setCompleteAssignment(null);
    router.refresh();
  }

  // Group by date
  const grouped = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const dateKey = format(new Date(a.eventDate), "yyyy-MM-dd");
    const arr = grouped.get(dateKey) ?? [];
    arr.push(a);
    grouped.set(dateKey, arr);
  }

  return (
    <>
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([dateKey, items]) => {
          const date = parseISO(dateKey);
          const dayLabel = isToday(date)
            ? "Today"
            : isTomorrow(date)
              ? "Tomorrow"
              : format(date, "EEEE, MMMM d");

          return (
            <div key={dateKey}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
                {dayLabel}
              </h3>
              <div className="space-y-3">
                {items.map((a) => (
                  <div
                    key={a.id}
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

                        {a.itemType && (
                          <span className="inline-block rounded bg-surface-2 px-2 py-0.5 text-2xs font-medium text-ink-secondary mb-2">
                            {a.itemType}
                          </span>
                        )}

                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-secondary mt-1">
                          {(a.arrivalTime || a.eventTime) && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-ink-muted" />
                              {a.arrivalTime && (
                                <span>Arrive {format(new Date(a.arrivalTime), "h:mm a")}</span>
                              )}
                              {a.eventTime && (
                                <span className="font-medium">· On Air {format(new Date(a.eventTime), "h:mm a")}</span>
                              )}
                            </div>
                          )}
                          {a.venueName && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-ink-muted" />
                              <span>{a.venueName}</span>
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
                            <span>{a.notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons for runners */}
                      {a.status !== "COMPLETED" && (
                        <div className="flex-shrink-0">
                          <button
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
  assignment: Assignment;
  onComplete: (id: string, notes?: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const notes = (form.get("notes") as string) || undefined;
    onComplete(assignment.id, notes);
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
