"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, User, FileText, Check, Briefcase, CalendarCheck, UserMinus, CalendarPlus } from "lucide-react";
import { googleCalendarUrl } from "@/lib/calendar-links";
import { Modal } from "@/components/ui/modal";
import { Button, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { Badge, statusTone, humanize } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
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
  internalNotes: string | null;
  status: string;
  accompanistCount: number;
  /** Display name only — runners never receive client IDs. */
  clientName: string | null;
  runner?: { id: string; name: string } | null;
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
  const [releaseAssignment, setReleaseAssignment] = useState<ScheduleItem | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  // "I can't attend": the runner steps down; the team is told and another runner is looked for.
  async function releaseMe(id: string, reason?: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/runner-assignments/${id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: typeof data?.error === "string" ? data.error : "Could not update", variant: "error" });
        return false;
      }
      setReleaseAssignment(null);
      toast({
        title: "You're off this activity",
        description: data?.data?.replacement ? `${data.data.replacement} was assigned instead.` : "The team has been notified to find another runner.",
        variant: "success",
      });
      router.refresh();
      return true;
    } catch {
      toast({ title: "Could not update", variant: "error" });
      return false;
    }
  }

  async function markCompleted(id: string, notes?: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/runner-assignments/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: typeof data?.error === "string" ? data.error : "Could not mark as completed",
          variant: "error",
        });
        return false;
      }
      setCompleteAssignment(null);
      toast({ title: "Marked as completed", variant: "success" });
      router.refresh();
      return true;
    } catch {
      toast({ title: "Network error — please try again", variant: "error" });
      return false;
    }
  }

  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={<CalendarCheck />}
        title="No upcoming assignments"
        description="You're all caught up."
      />
    );
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
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([dateKey, items]) => {
          const isPast = dateKey < todayKey;
          const dayLabel =
            dateKey === todayKey
              ? "Today"
              : dateKey === tomorrowKey
                ? "Tomorrow"
                : formatDayKey(dateKey, "EEEE, MMMM d");

          return (
            <section key={dateKey}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="eyebrow">{dayLabel}</h3>
                {dateKey === todayKey && (
                  <span className="text-2xs text-ink-muted">
                    {formatDayKey(dateKey, "MMMM d")}
                  </span>
                )}
                {isPast && <Badge tone="warning" size="xs">Pending completion</Badge>}
              </div>

              <div className="space-y-3">
                {items.map((a) => (
                  <Card
                    key={a.id}
                    id={`assignment-${a.id}`}
                    padding="sm"
                    interactive
                    className="p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <h4 className="min-w-0 break-words text-base font-semibold leading-snug text-ink-primary">
                            {a.eventName}
                          </h4>
                          <Badge tone={statusTone(a.status)} dot>
                            {humanize(a.status)}
                          </Badge>
                        </div>

                        <div className="mb-3 flex flex-wrap items-center gap-1.5">
                          {a.clientName && (
                            <Badge tone="outline" size="xs">
                              <Briefcase className="h-3 w-3 text-ink-muted" />
                              {a.clientName}
                            </Badge>
                          )}
                          {a.itemType && (
                            <Badge size="xs">{a.itemType}</Badge>
                          )}
                          {showRunner && a.runner && (
                            <Badge tone="outline" size="xs">
                              <User className="h-3 w-3 text-ink-muted" />
                              {a.runner.name}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5 text-sm text-ink-secondary sm:flex-row sm:flex-wrap sm:gap-x-5">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 shrink-0 text-ink-muted" />
                            {a.arrivalTime && <span>Arrive {formatInTz(a.arrivalTime, TIME)}</span>}
                            {a.eventTime ? (
                              <span className="font-medium text-ink-primary">
                                {a.arrivalTime ? "· " : ""}On Air {formatInTz(a.eventTime, TIME)}
                              </span>
                            ) : !a.arrivalTime ? (
                              <span>{formatInTz(a.eventDate, TIME)}</span>
                            ) : null}
                          </div>

                          {(a.venueName || a.location) && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                              <span>
                                {a.venueName}
                                {a.venueName && a.location ? " · " : ""}
                                {a.location}
                              </span>
                            </div>
                          )}

                          {a.accompanistCount > 0 && (
                            <div className="flex items-center gap-1.5">
                              <User className="h-4 w-4 shrink-0 text-ink-muted" />
                              <span>
                                {a.accompanistCount} accompanist
                                {a.accompanistCount > 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </div>

                        {a.venueAddress && (
                          <p className="mt-1.5 text-xs text-ink-muted">{a.venueAddress}</p>
                        )}

                        {(a.internalNotes || a.notes) && (
                          <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-1 p-3 text-xs text-ink-secondary">
                            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" />
                            <span className="whitespace-pre-line">{[a.internalNotes, a.notes].filter(Boolean).join("\n")}</span>
                          </div>
                        )}
                      </div>

                      {/* Completion / step-down actions */}
                      {a.status !== "COMPLETED" && a.status !== "CANCELLED" && (
                        <div className="flex shrink-0 flex-col gap-2 border-t border-border pt-3 sm:border-0 sm:pt-0 sm:items-end">
                          <Button
                            size="lg"
                            leftIcon={<Check className="h-4 w-4" />}
                            onClick={() => setCompleteAssignment(a)}
                            className="h-12 w-full sm:h-10 sm:w-auto"
                          >
                            Mark complete
                          </Button>
                          <Button asChild size="sm" variant="ghost" leftIcon={<CalendarPlus className="h-4 w-4" />} className="w-full text-ink-secondary sm:w-auto">
                            <a href={googleCalendarUrl(a)} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
                          </Button>
                          {!showRunner && a.dayKey >= todayKey && (
                            <Button
                              size="sm"
                              variant="ghost"
                              leftIcon={<UserMinus className="h-4 w-4" />}
                              onClick={() => setReleaseAssignment(a)}
                              className="w-full text-ink-muted hover:text-red-700 sm:w-auto"
                            >
                              I can't attend
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {releaseAssignment && (
        <ReleaseModal
          open={!!releaseAssignment}
          onOpenChange={(o) => {
            if (!o) setReleaseAssignment(null);
          }}
          assignment={releaseAssignment}
          onRelease={releaseMe}
        />
      )}

      {/* Complete Assignment Modal */}
      {completeAssignment && (
        <CompleteModal
          open={!!completeAssignment}
          onOpenChange={(o) => {
            if (!o) setCompleteAssignment(null);
          }}
          assignment={completeAssignment}
          onComplete={markCompleted}
        />
      )}
    </>
  );
}

function ReleaseModal({
  open,
  onOpenChange,
  assignment,
  onRelease,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignment: ScheduleItem;
  onRelease: (id: string, reason?: string) => Promise<boolean>;
}) {
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const reason = ((new FormData(e.currentTarget).get("reason") as string) || "").trim() || undefined;
    const ok = await onRelease(assignment.id, reason);
    if (!ok) setLoading(false);
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="I can't attend" description={assignment.eventName}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ink-secondary">
          You'll be taken off this activity. The team gets notified right away and another runner is assigned automatically when someone is available.
        </p>
        <FormGroup label="Reason" htmlFor="rel-reason" hint="Optional, but it helps the team">
          <Textarea id="rel-reason" name="reason" rows={3} placeholder="e.g. work conflict, out of town, sick…" />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button type="submit" variant="destructive" loading={loading} leftIcon={<UserMinus className="h-4 w-4" />}>
            Take me off
          </Button>
        </FormActions>
      </form>
    </Modal>
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
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Mark as Completed"
      description={assignment.eventName}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label="Post-event notes" htmlFor="comp-notes" hint="Optional">
          <Textarea
            id="comp-notes"
            name="notes"
            rows={4}
            placeholder="Any feedback, issues, or wins from this event…"
          />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} leftIcon={<Check className="h-4 w-4" />}>
            Mark completed
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
