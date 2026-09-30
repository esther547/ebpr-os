"use client";

import { CalendarPlus, Clock, MapPin, User, FileText, Lock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge, statusTone, humanize } from "@/components/ui/badge";
import { Button } from "@/components/ui/form-field";
import { formatDayKey, formatInTz } from "@/components/runners/miami-time";
import { googleCalendarUrl } from "@/lib/calendar-links";
import type { ScheduleAssignment } from "./runner-schedule-view";

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

/** Everything about one pauta, including the internal notes (contacts) — runners asked to see them. */
export function PautaDetailModal({ pauta, onClose }: { pauta: ScheduleAssignment | null; onClose: () => void }) {
  const p = pauta;
  return (
    <Modal open={!!p} onOpenChange={(o) => !o && onClose()} title={p?.eventName ?? ""} description={p?.clientName ?? undefined}>
      {p && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={p.runnerId ? statusTone(p.status) : "danger"} dot>{p.runnerId ? humanize(p.status) : "Needs runner"}</Badge>
            {p.itemType && <Badge tone="outline" size="xs">{p.itemType}</Badge>}
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
              <div>
                <p className="font-medium text-ink-primary">{formatDayKey(p.dayKey, "EEEE, MMMM d")}</p>
                <p className="text-ink-secondary">
                  {p.arrivalTime && <>Arrive {formatInTz(p.arrivalTime, TIME)} · </>}
                  {p.eventTime ? <>On Air {formatInTz(p.eventTime, TIME)}</> : !p.arrivalTime ? formatInTz(p.eventDate, TIME) : null}
                </p>
              </div>
            </div>
            {(p.venueName || p.venueAddress || p.location) && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                <div>
                  {p.venueName && <p className="font-medium text-ink-primary">{p.venueName}</p>}
                  {p.venueAddress && <p className="text-ink-secondary">{p.venueAddress}</p>}
                  {!p.venueName && !p.venueAddress && p.location && <p className="text-ink-secondary">{p.location}</p>}
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
              <p className="text-ink-secondary">{p.runner ? <>Runner: <span className="font-medium text-ink-primary">{p.runner.name}</span>{p.autoAssigned ? " · auto" : ""}</> : "Nadie asignado todavía"}</p>
            </div>
          </dl>

          {p.internalNotes && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm">
              <p className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-amber-800"><Lock className="h-3 w-3" /> Notas internas · contactos (nunca las ve el cliente)</p>
              <p className="whitespace-pre-line break-words text-ink-primary">{p.internalNotes}</p>
            </div>
          )}
          {p.notes && (
            <div className="rounded-lg bg-surface-1 p-3 text-sm">
              <p className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted"><FileText className="h-3 w-3" /> Notas</p>
              <p className="whitespace-pre-line break-words text-ink-secondary">{p.notes}</p>
            </div>
          )}

          <Button asChild variant="secondary" size="lg" leftIcon={<CalendarPlus className="h-4 w-4" />} className="h-11 w-full">
            <a href={googleCalendarUrl(p)} target="_blank" rel="noopener noreferrer">Agregar a Google Calendar</a>
          </Button>
        </div>
      )}
    </Modal>
  );
}
