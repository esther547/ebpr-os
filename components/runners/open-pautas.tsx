"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, MapPin, Hand, CalendarCheck, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, statusTone, humanize } from "@/components/ui/badge";
import { Button } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatDayKey, formatInTz } from "@/components/runners/miami-time";

export type OpenPauta = {
  id: string;
  eventName: string;
  dayKey: string;
  eventTime?: string | null;
  arrivalTime?: string | null;
  venueName?: string | null;
  location?: string | null;
  itemType?: string | null;
  status: string;
  clientName?: string | null;
};

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

/**
 * Every future pauta with nobody on it. Runners see "I can take this" (claim); the internal
 * Runner Schedule passes `onAssign` and gets an "Assign runner" button instead.
 */
export function OpenPautas<T extends OpenPauta>({ pautas, onAssign }: { pautas: T[]; onAssign?: (p: T) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [target, setTarget] = useState<OpenPauta | null>(null);
  const [loading, setLoading] = useState(false);

  async function claim(p: OpenPauta) {
    setLoading(true);
    try {
      const res = await fetch(`/api/runner-assignments/${p.id}/claim`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: typeof data?.error === "string" ? data.error : "Could not take this pauta", variant: "error" });
        return;
      }
      toast({ title: "It's yours", description: `${p.eventName} · ${formatDayKey(p.dayKey, "EEE, MMM d")}. The team has been notified.`, variant: "success" });
      setTarget(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (pautas.length === 0) {
    return <EmptyState icon={<CalendarCheck />} title="No open pautas" description="Every upcoming pauta already has a runner." />;
  }

  // Group by day, in date order (the server already sorted them).
  const days = new Map<string, T[]>();
  for (const p of pautas) days.set(p.dayKey, [...(days.get(p.dayKey) ?? []), p]);

  return (
    <>
      <div className="space-y-5">
        {[...days.entries()].map(([dayKey, items]) => (
          <section key={dayKey}>
            <h3 className="eyebrow mb-2">{formatDayKey(dayKey, "EEEE, MMMM d")}</h3>
            <div className="space-y-2">
              {items.map((p) => (
                <Card key={p.id} padding="sm" className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {p.clientName && <p className="text-xs font-semibold uppercase tracking-wide text-accent2">{p.clientName}</p>}
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <p className="break-words text-base font-semibold leading-snug text-ink-primary">{p.eventName}</p>
                        <Badge tone={statusTone(p.status)} dot>{humanize(p.status)}</Badge>
                        {p.itemType && <Badge tone="outline" size="xs">{p.itemType}</Badge>}
                      </div>
                      <div className="mt-1.5 flex flex-col gap-1 text-sm text-ink-secondary sm:flex-row sm:flex-wrap sm:gap-x-4">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 shrink-0 text-ink-muted" />
                          {p.arrivalTime && <span>Arrive {formatInTz(p.arrivalTime, TIME)}</span>}
                          {p.eventTime ? <span className="font-medium text-ink-primary">{p.arrivalTime ? "· " : ""}On Air {formatInTz(p.eventTime, TIME)}</span> : !p.arrivalTime ? <span>Time TBD</span> : null}
                        </span>
                        {(p.venueName || p.location) && (
                          <span className="flex items-start gap-1.5">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                            <span>{[p.venueName, p.location].filter(Boolean).join(" · ")}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {onAssign ? (
                      <Button size="lg" leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => onAssign(p)} className="h-12 w-full shrink-0 sm:h-10 sm:w-auto">
                        Assign runner
                      </Button>
                    ) : (
                      <Button size="lg" variant="secondary" leftIcon={<Hand className="h-4 w-4" />} onClick={() => setTarget(p)} className="h-12 w-full shrink-0 sm:h-10 sm:w-auto">
                        I can take this
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
      <ConfirmModal
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Take this pauta?"
        description={target ? `${target.clientName ? target.clientName + " · " : ""}${target.eventName} · ${formatDayKey(target.dayKey, "EEEE, MMMM d")}. You'll be the runner and the team gets notified.` : undefined}
        confirmLabel="Yes, I'll take it"
        loading={loading}
        onConfirm={() => { if (target) void claim(target); }}
      />
    </>
  );
}
