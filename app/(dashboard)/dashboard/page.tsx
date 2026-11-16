import Link from "next/link";
import { shortName } from "@/lib/short-name";
import { ArrowUpRight, CalendarClock, Gauge, Target, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamPace, WEEKLY_GOAL_TARGET } from "@/lib/dashboard-goals";
import { closingBoard, GOAL_CLOSING } from "@/lib/goal-closing";
import { canManageClients } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/header";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClosingEdit } from "@/components/dashboard/closing-edit";
import { formatDayKey } from "@/components/runners/miami-time";

export const metadata = { title: "Dashboard — EBPR OS" };
export const dynamic = "force-dynamic";

/**
 * Dashboard (Esther, Nov 16 2026): the year closes on Dec 15. One count — the goals each active client is
 * still owed until that day, as she counted them — plus the pace the team needs and the pace it has.
 * The earlier period-by-period count (overdue / in course) was retired at her request.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const canEdit = canManageClients(user);
  const now = new Date();

  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, closingOwed: true, closingNote: true, closingHold: true },
    orderBy: { name: "asc" },
  });
  const [closing, pace] = await Promise.all([closingBoard(clients, now), teamPace(now)]);

  const { dueLabel, dueShort, sinceShort } = GOAL_CLOSING;
  const weeksLeft = Math.max(1, closing.daysLeft / 7);
  const perWeek = Math.ceil(closing.pending / weeksLeft);
  // Esther's reference (6 to 8 a week) is per strategist, so she is not part of the divisor.
  const strategists = Math.max(1, await db.user.count({ where: { isActive: true, role: "STRATEGIST" } }));
  const perStrategist = Math.round((perWeek / strategists) * 10) / 10;
  const paceTone = perStrategist <= 8 ? "success" : perStrategist <= 10 ? "warning" : "danger";
  const owing = closing.rows.filter((r) => r.pending > 0);
  const upToDate = closing.rows.filter((r) => r.pending === 0);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${clients.length} clientes activos · ${GOAL_CLOSING.label}: cerramos el ${dueLabel}.`} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={`Por cerrar al ${dueShort}`} value={closing.pending} hint={`de ${closing.owed} contadas el ${sinceShort} · ${closing.closed} cerrada${closing.closed === 1 ? "" : "s"} desde entonces`} icon={<Target />} tone={closing.pending === 0 ? "success" : "neutral"} />
        <StatTile label="Días que quedan" value={closing.daysLeft} hint={`${Math.round(weeksLeft * 10) / 10} semanas hasta el ${dueLabel}`} icon={<CalendarClock />} tone={closing.daysLeft <= 7 ? "warning" : "neutral"} />
        <StatTile label="Necesarias por semana" value={perWeek} hint={`≈ ${perStrategist} por estratega (${strategists} estrategas) · lo normal es 6 a 8`} icon={<TrendingUp />} tone={paceTone} />
        <StatTile label="Cerradas esta semana" value={`${pace.teamThisWeek} / ${perWeek}`} hint="lo que lleva el equipo vs. lo que hace falta por semana" icon={<Gauge />} tone={pace.teamThisWeek >= perWeek ? "success" : "warning"} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card padding="none" className="p-4 sm:p-5">
          <p className="eyebrow">Ritmo semanal · {formatDayKey(pace.weekStart, "d MMM")} – {formatDayKey(pace.weekEnd, "d MMM")}</p>
          <p className="mt-0.5 text-xs text-ink-muted">Metas cerradas por estratega esta semana (meta de referencia: {WEEKLY_GOAL_TARGET}). Entre paréntesis, la semana pasada.</p>
          <ul className="mt-3 space-y-2">
            {pace.rows.map((r) => { const pct = Math.min(100, Math.round((r.thisWeek / WEEKLY_GOAL_TARGET) * 100)); return (
              <li key={r.id} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate font-medium">{shortName(r.name, pace.rows)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full", r.thisWeek >= WEEKLY_GOAL_TARGET ? "bg-emerald-500" : r.thisWeek >= 4 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${pct}%` }} /></div>
                <span className="w-20 shrink-0 text-right tabular"><span className="font-semibold">{r.thisWeek}</span><span className="text-xs text-ink-muted"> / {WEEKLY_GOAL_TARGET} ({r.lastWeek})</span></span>
              </li>); })}
            {pace.unassigned > 0 && <li className="text-xs text-ink-muted">+ {pace.unassigned} cerradas sin estratega asignado esta semana</li>}
          </ul>
        </Card>
        <Card padding="none" className="p-4 sm:p-5">
          <p className="eyebrow">Al día, en hold y sin número</p>
          <p className="mt-0.5 text-xs text-ink-muted">Clientes activos que hoy no suman al conteo.</p>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-emerald-700">Al día de metas ({upToDate.length})</p>
              {upToDate.length === 0 ? <p className="text-xs text-ink-muted">Ninguno todavía.</p> : (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {upToDate.map((r) => (
                    <span key={r.id} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900" title={r.note ?? undefined}>
                      <Link href={`/clients/${r.id}/agenda`} className="hover:underline">{r.name}</Link>
                      {canEdit && <ClosingEdit clientId={r.id} clientName={r.name} pending={r.pending} closed={Math.min(r.closed, r.owed)} note={r.note} hold={r.hold} dueLabel={dueLabel} />}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {closing.onHold.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-700">En hold · se les debe, pero no suman al conteo ({closing.onHold.length})</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {closing.onHold.map((r) => (
                    <span key={r.id} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-900" title={r.note ?? undefined}>
                      <Link href={`/clients/${r.id}/agenda`} className="hover:underline">{r.name}</Link>
                      <span className="tabular font-semibold">{r.pending}</span>
                      {canEdit && <ClosingEdit clientId={r.id} clientName={r.name} pending={r.pending} closed={Math.min(r.closed, r.owed)} note={r.note} hold={r.hold} dueLabel={dueLabel} />}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {closing.uncounted.length > 0 && (
              <div>
                <p className="text-xs font-medium text-ink-secondary">Sin número de metas ({closing.uncounted.length})</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {closing.uncounted.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-0.5 text-xs text-ink-secondary">
                      <Link href={`/clients/${c.id}/agenda`} className="hover:underline">{c.name}</Link>
                      {canEdit && <ClosingEdit clientId={c.id} clientName={c.name} pending={null} closed={0} note={null} hold={false} dueLabel={dueLabel} />}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {closing.byStrategist.length > 0 && (
        <Card padding="none" className="mb-6 p-4 sm:p-5">
          <p className="eyebrow">Metas cerradas por estratega · desde el {sinceShort}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {closing.byStrategist.map((s) => (
              <span key={s.name} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm", s.name === "Sin estratega" ? "border-dashed border-border text-ink-muted" : "border-border bg-white text-ink-primary")}>
                <span className="font-medium">{s.name === "Sin estratega" ? s.name : shortName(s.name, closing.byStrategist)}</span>
                <span className="tabular text-ink-secondary">{s.goals}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className="border-b border-border px-5 py-3">
          <p className="eyebrow">Metas que se deben al {dueLabel} · por cliente</p>
          <p className="mt-0.5 text-xs text-ink-muted">El número de cada cliente baja solo cuando se cierra una meta nueva. Primero los que más deben.</p>
        </div>
        <ol className="divide-y divide-border">
          {owing.map((r, i) => {
            const pct = r.owed > 0 ? Math.min(100, Math.round((Math.min(r.closed, r.owed) / r.owed) * 100)) : 0;
            return (
              <li key={r.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="w-6 shrink-0 text-xs text-ink-muted tabular">{i + 1}</span>
                  <Link href={`/clients/${r.id}/deliverables`} className="group inline-flex w-full items-center gap-1 text-sm font-semibold text-ink-primary hover:text-accent2 sm:w-56">
                    {r.name}
                    <ArrowUpRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-accent2" />
                  </Link>
                  <div className="min-w-[160px] flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    <span className="text-xs text-ink-muted tabular">{Math.min(r.closed, r.owed)} de {r.owed} cerradas</span>
                    <Badge tone={r.pending >= 15 ? "danger" : r.pending >= 8 ? "warning" : "neutral"} size="xs" dot>Faltan {r.pending}</Badge>
                    {canEdit && <ClosingEdit clientId={r.id} clientName={r.name} pending={r.pending} closed={Math.min(r.closed, r.owed)} note={r.note} hold={r.hold} dueLabel={dueLabel} />}
                  </span>
                </div>
                {(r.note || r.strategists.length > 0) && (
                  <p className="mt-1 pl-10 text-xs text-ink-muted">
                    {r.note}
                    {r.note && r.strategists.length > 0 ? " · " : ""}
                    {r.strategists.length > 0 && <><span className="text-ink-secondary">Cerradas por:</span>{" "}{r.strategists.map((s, k) => (
                      <span key={s.name}>{k > 0 ? " · " : ""}{s.name === "Sin estratega" ? "sin estratega" : shortName(s.name, r.strategists)} <span className="tabular font-medium text-ink-primary">{s.goals}</span></span>
                    ))}</>}
                  </p>
                )}
              </li>
            );
          })}
          {owing.length === 0 && <li className="px-5 py-6 text-sm text-ink-muted">{closing.rows.length ? "Todos los clientes están al día." : "Todavía no hay metas cargadas para el cierre."}</li>}
        </ol>
      </Card>
    </>
  );
}
