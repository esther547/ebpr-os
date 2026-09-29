"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, Plus, Download, Pencil, Trash2, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, Input, FormGroup, FormActions } from "@/components/ui/form-field";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { addDaysKey, dayKeyInTz, formatDayKey, formatInTz, tzMidnight } from "@/components/runners/miami-time";
import type { TimeEntryDTO } from "@/lib/time-tracking";

const HM: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const H24: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };

/** 3725 s → "1:02:05" */
function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
/** 5400000 → "1h 30m" */
function hm(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}
const dur = (e: TimeEntryDTO, now: number) => (e.endedAt ? new Date(e.endedAt).getTime() : now) - new Date(e.startedAt).getTime();
/** Miami wall time "yyyy-MM-dd" + "HH:mm" → ISO instant. */
function toInstant(dayKey: string, time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Date(tzMidnight(dayKey).getTime() + (h * 60 + m) * 60000).toISOString();
}

type Props = {
  initialEntries: TimeEntryDTO[];
  weekKey: string;
  canRun: boolean;
  ownerName: string;
  /** This week's to-dos, suggested as descriptions. */
  todoTitles: string[];
  /** Server render time (ms): the first client render uses it too, so hydration matches. */
  serverNow: number;
};

export function TimeTracker({ initialEntries, weekKey, canRun, ownerName, todoTitles, serverNow }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [entries, setEntries] = useState(initialEntries);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(serverNow);
  // Times and durations are locale/clock dependent: render them only in the browser (no hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setNow(Date.now()); setMounted(true); }, []);
  const [editing, setEditing] = useState<TimeEntryDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<TimeEntryDTO | null>(null);
  useEffect(() => setEntries(initialEntries), [initialEntries]);

  const running = entries.find((e) => !e.endedAt) ?? null;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const todayKey = dayKeyInTz(new Date(now));
  const inWeek = (e: TimeEntryDTO) => { const k = dayKeyInTz(new Date(e.startedAt)); return k >= weekKey && k < addDaysKey(weekKey, 7); };
  const weekEntries = useMemo(() => entries.filter(inWeek), [entries, weekKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekTotal = weekEntries.reduce((s, e) => s + dur(e, now), 0);
  const todayTotal = weekEntries.filter((e) => dayKeyInTz(new Date(e.startedAt)) === todayKey).reduce((s, e) => s + dur(e, now), 0);
  const days = useMemo(() => {
    const m = new Map<string, TimeEntryDTO[]>();
    for (const e of [...weekEntries].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
      const k = dayKeyInTz(new Date(e.startedAt));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [weekEntries]);

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
    return data.data;
  }
  const fail = (err: unknown) => toast({ title: err instanceof Error ? err.message : "No se pudo guardar", variant: "error" });

  async function start(desc?: string) {
    const text = (desc ?? description).trim();
    if (!text) return toast({ title: "Escribe en qué estás trabajando", variant: "error" });
    setBusy(true);
    try {
      const e: TimeEntryDTO = await call("/api/time-entries", { method: "POST", body: JSON.stringify({ description: text }) });
      const stoppedAt = new Date().toISOString();
      setEntries((prev) => [...prev.map((x) => (x.endedAt ? x : { ...x, endedAt: stoppedAt })), e]);
      setDescription("");
      setNow(Date.now());
      router.refresh();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function stop() {
    if (!running) return;
    setBusy(true);
    try {
      const e: TimeEntryDTO = await call(`/api/time-entries/${running.id}`, { method: "PATCH", body: JSON.stringify({ stop: true }) });
      setEntries((prev) => prev.map((x) => (x.id === e.id ? e : x)));
      toast({ title: `Registrado: ${hm(dur(e, Date.now()))}`, description: e.description, variant: "success" });
      router.refresh();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function remove(e: TimeEntryDTO) {
    setDeleting(null);
    try {
      await call(`/api/time-entries/${e.id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((x) => x.id !== e.id));
      router.refresh();
    } catch (err) { fail(err); }
  }

  if (!mounted) {
    return (
      <Card padding="none" className="mb-6 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-ink-muted" />
          <h2 className="text-sm font-semibold text-ink-primary">Horas de {ownerName.split(" ")[0]}</h2>
        </div>
        <div className="mt-3 h-11 animate-pulse rounded-lg bg-surface-2" />
      </Card>
    );
  }

  return (
    <Card padding="none" className="mb-6 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-ink-muted" />
          <h2 className="text-sm font-semibold text-ink-primary">Horas de {ownerName.split(" ")[0]}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-ink-muted">Hoy <strong className="tabular text-ink-primary">{hm(todayTotal)}</strong></span>
          <span className="text-ink-muted">Semana <strong className="tabular text-ink-primary">{hm(weekTotal)}</strong></span>
          <a href={`/api/time-entries?week=${weekKey}&format=csv`} className="inline-flex items-center gap-1 text-xs font-medium text-ink-secondary hover:text-accent2">
            <Download className="h-3.5 w-3.5" /> Exportar
          </a>
        </div>
      </div>

      {/* Timer bar */}
      {running ? (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-semibold uppercase tracking-wide text-emerald-700">{canRun ? "En curso" : `${ownerName.split(" ")[0]} está trabajando`}</p>
            <p className="truncate text-sm font-medium text-ink-primary">{running.description}</p>
          </div>
          <span className="tabular text-2xl font-semibold text-ink-primary">{clock(now - new Date(running.startedAt).getTime())}</span>
          {canRun && (
            <Button variant="destructive" size="lg" loading={busy} leftIcon={<Square className="h-4 w-4" />} onClick={() => void stop()} className="h-11 w-full sm:w-auto">
              Detener
            </Button>
          )}
        </div>
      ) : canRun ? (
        <form onSubmit={(e) => { e.preventDefault(); void start(); }} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            list="timer-todos"
            placeholder="¿En qué estás trabajando?"
            aria-label="Descripción"
            className="h-11 flex-1"
          />
          <datalist id="timer-todos">{todoTitles.map((t) => <option key={t} value={t} />)}</datalist>
          <Button type="submit" size="lg" loading={busy} leftIcon={<Play className="h-4 w-4" />} className="h-11 w-full sm:w-auto">
            Iniciar
          </Button>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">Sin timer corriendo.</p>
      )}

      {canRun && (
        <div className="mt-2">
          <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center gap-1 text-xs font-medium text-ink-secondary hover:text-accent2">
            <Plus className="h-3.5 w-3.5" /> Agregar tiempo manual
          </button>
        </div>
      )}

      {/* Entries of the week */}
      {days.length > 0 && (
        <div className="mt-4 space-y-3">
          {days.map(([dayKey, list]) => (
            <div key={dayKey}>
              <div className="mb-1 flex items-center justify-between text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                <span>{dayKey === todayKey ? "Hoy" : formatDayKey(dayKey, "EEEE d MMM")}</span>
                <span className="tabular">{hm(list.reduce((s, e) => s + dur(e, now), 0))}</span>
              </div>
              <ul className="divide-y divide-border/60 rounded-lg border border-border">
                {list.map((e) => (
                  <li key={e.id} className="group flex items-center gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-ink-primary">{e.description}</p>
                      <p className="text-2xs text-ink-muted">{formatInTz(e.startedAt, HM)} – {e.endedAt ? formatInTz(e.endedAt, HM) : "en curso"}</p>
                    </div>
                    <span className="tabular shrink-0 text-sm font-medium text-ink-primary">{e.endedAt ? hm(dur(e, now)) : clock(dur(e, now))}</span>
                    {canRun && (
                      <div className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                        {e.endedAt && (
                          <button type="button" aria-label="Continuar" title="Continuar con esto" onClick={() => void start(e.description)} className="rounded p-1 text-ink-muted hover:text-emerald-700"><Play className="h-3.5 w-3.5" /></button>
                        )}
                        <button type="button" aria-label="Editar" onClick={() => setEditing(e)} className="rounded p-1 text-ink-muted hover:text-ink-primary"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label="Eliminar" onClick={() => setDeleting(e)} className="rounded p-1 text-ink-muted hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EntryModal
          entry={editing === "new" ? null : editing}
          defaultDay={todayKey >= weekKey && todayKey < addDaysKey(weekKey, 7) ? todayKey : weekKey}
          onClose={() => setEditing(null)}
          onSaved={(e) => {
            setEntries((prev) => (prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [...prev, e]));
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      <ConfirmModal
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Eliminar entrada"
        description={deleting ? `${deleting.description} · ${hm(dur(deleting, now))}` : undefined}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => { if (deleting) void remove(deleting); }}
      />
    </Card>
  );
}

function EntryModal({ entry, defaultDay, onClose, onSaved }: { entry: TimeEntryDTO | null; defaultDay: string; onClose: () => void; onSaved: (e: TimeEntryDTO) => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const day0 = entry ? dayKeyInTz(new Date(entry.startedAt)) : defaultDay;
  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const day = String(f.get("day"));
    const startedAt = toInstant(day, String(f.get("start")));
    const endRaw = String(f.get("end") || "");
    let endedAt: string | null = endRaw ? toInstant(day, endRaw) : null;
    if (endedAt && endedAt <= startedAt) endedAt = toInstant(addDaysKey(day, 1), endRaw); // crossed midnight
    const body = { description: String(f.get("description") || "").trim(), startedAt, endedAt };
    setSaving(true);
    try {
      const res = await fetch(entry ? `/api/time-entries/${entry.id}` : "/api/time-entries", {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry && !entry.endedAt && !endRaw ? { description: body.description, startedAt } : body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "No se pudo guardar");
      onSaved(data.data);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "No se pudo guardar", variant: "error" });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={entry ? "Editar entrada" : "Agregar tiempo manual"}>
      <form onSubmit={submit} className="space-y-4">
        <FormGroup label="Descripción" htmlFor="te-desc">
          <Input id="te-desc" name="description" required defaultValue={entry?.description ?? ""} placeholder="En qué trabajaste" />
        </FormGroup>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormGroup label="Día" htmlFor="te-day"><Input id="te-day" name="day" type="date" required defaultValue={day0} /></FormGroup>
          <FormGroup label="Inicio" htmlFor="te-start"><Input id="te-start" name="start" type="time" required defaultValue={entry ? formatInTz(entry.startedAt, H24) : "09:00"} /></FormGroup>
          <FormGroup label="Fin" htmlFor="te-end"><Input id="te-end" name="end" type="time" required={!entry || !!entry.endedAt} defaultValue={entry?.endedAt ? formatInTz(entry.endedAt, H24) : entry ? "" : "10:00"} /></FormGroup>
        </div>
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Guardar</Button>
        </FormActions>
      </form>
    </Modal>
  );
}
