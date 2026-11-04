import Link from "next/link";
import { shortName } from "@/lib/short-name";
import { ArrowUpRight, AlertTriangle, Gauge, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STRATEGIST_ROLES } from "@/lib/strategist-report";
import { goalOutlook, teamPace, WEEKLY_GOAL_TARGET } from "@/lib/dashboard-goals";
import { isClosedGoal, isOpenGoal } from "@/lib/goal-status";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/header";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeliverablePacingBar } from "@/components/deliverables/pacing-bar";
import { MonthCompleteToggle } from "@/components/dashboard/month-complete-toggle";
import { currentCycle, cycleLabel } from "@/lib/cycles";
import { formatDayKey } from "@/components/runners/miami-time";
import { dayKeyInTz } from "@/components/runners/miami-time";

export const metadata = { title: "Dashboard — EBPR OS" };
export const dynamic = "force-dynamic";

/**
 * Dashboard, simplified (Esther, Sept 27 2026): how many active clients, how many
 * deliverables this cycle, and the clients ordered by how urgently they need goals.
 */
export default async function DashboardPage() {
  await requireUser();
  const now = new Date();
  const todayKey = dayKeyInTz(now);

  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, monthlyTarget: true, cycleDay: true, goalsOwed: true },
    orderBy: { name: "asc" },
  });

  // Deliverables of each client's CURRENT cycle (fecha de corte).
  const cycleByClient = new Map(clients.map((c) => [c.id, currentCycle(c.cycleDay, now)]));
  const labels = new Map<string, { month: number; year: number }>();
  for (const c of cycleByClient.values()) labels.set(`${c.year}-${c.month}`, { month: c.month, year: c.year });
  const deliverables = labels.size
    ? (
        await db.deliverable.findMany({
          where: { OR: Array.from(labels.values()), status: { not: "CANCELLED" }, clientId: { in: clients.map((c) => c.id) } },
          select: { clientId: true, status: true, month: true, year: true },
        })
      ).filter((d) => {
        const c = cycleByClient.get(d.clientId);
        return c && c.month === d.month && c.year === d.year;
      })
    : [];

  // Manual "month complete" marks (e.g. a client that doubled up the month before).
  const overrides = await db.clientMonthOverride.findMany({
    where: { clientId: { in: clients.map((c) => c.id) }, isComplete: true },
    select: { clientId: true, year: true, month: true, note: true },
  });
  const overrideOf = (clientId: string, year: number, month: number) => overrides.find((o) => o.clientId === clientId && o.year === year && o.month === month) ?? null;

  const pacing = new Map<string, { completed: number; inProgress: number }>();
  for (const d of deliverables) {
    const p = pacing.get(d.clientId) ?? { completed: 0, inProgress: 0 };
    // "Completed" here means CLOSED (confirmed or executed); "in progress" = still pitching.
    if (isClosedGoal(d.status)) p.completed++;
    else if (isOpenGoal(d.status)) p.inProgress++;
    pacing.set(d.clientId, p);
  }

  const daysLeft = (endKey: string) => {
    const a = new Date(`${todayKey}T00:00:00Z`).getTime();
    const b = new Date(`${endKey}T00:00:00Z`).getTime();
    return Math.max(0, Math.round((b - a) / 86_400_000));
  };

  // Service periods placed in time (overdue / in course / future) — see lib/dashboard-goals.ts.
  const outlook = await goalOutlook(clients, now);
  const pace = await teamPace(now);
  const current = new Map([...outlook.relevant].map(([id, slot]) => [id, slot.period]));

  // Who closed what in each client's current period (Esther, Oct 6 2026: "cuántas son por estratega").
  const goalIds = [...current.values()].flatMap((p) => p.units.map((u) => u.goalId).filter((x): x is string => !!x));
  // Only strategists (not runners who closed a pauta) are credited by name — Diana is a runner (Esther, Oct 12 2026).
  const isStrategist = (u: { role: string } | null) => !!u && (STRATEGIST_ROLES as string[]).includes(u.role);
  const closers = new Map((await db.deliverable.findMany({ where: { id: { in: goalIds } }, select: { id: true, closedBy: { select: { name: true, role: true } }, assignee: { select: { name: true, role: true } } } })).map((g) => [g.id, isStrategist(g.closedBy) ? g.closedBy!.name : isStrategist(g.assignee) ? g.assignee!.name : null]));
  const byStrategist = new Map<string, number>();
  const perClient = new Map<string, { name: string; goals: number }[]>();
  for (const [clientId, p] of current) {
    const m = new Map<string, number>();
    for (const u of p.units) {
      const who = (u.goalId ? closers.get(u.goalId) : null) ?? "Sin estratega";
      m.set(who, (m.get(who) ?? 0) + u.weight);
      byStrategist.set(who, (byStrategist.get(who) ?? 0) + u.weight);
    }
    perClient.set(clientId, [...m.entries()].map(([name, goals]) => ({ name, goals })).sort((a, b) => b.goals - a.goals));
  }
  const strategistTotals = [...byStrategist.entries()].sort((a, b) => b[1] - a[1]);

  const rows = clients.map((c) => {
    const cur = current.get(c.id);
    // The period is due at the end of the client's cycle whose label is the period's reference month.
    const slot = outlook.relevant.get(c.id);
    const cycle = slot ? slot.cycle : cycleByClient.get(c.id)!;
    const p0 = pacing.get(c.id) ?? { completed: 0, inProgress: 0 };
    const p = { ...p0, completed: cur ? cur.achieved : p0.completed };
    if (cur) c = { ...c, monthlyTarget: cur.target };
    const target = c.monthlyTarget; // "debidas" are no longer a manual number: overdue periods are computed below
    const override = overrideOf(c.id, cycle.year, cycle.month);
    const remaining = override ? 0 : Math.max(0, target - p.completed);
    const left = daysLeft(cycle.endKey);
    // Urgency: goals still missing per day left (more missing + fewer days = more urgent).
    const urgency = remaining === 0 ? -1 : remaining / Math.max(left, 1);
    return { ...c, cycle, completed: p.completed, inProgress: p.inProgress, target, remaining, left, urgency, override, period: cur ?? null, state: slot?.state ?? "inCourse", strategists: perClient.get(c.id) ?? [] };
  });

  const active = rows.filter((r) => r.target > 0).sort((a, b) => b.urgency - a.urgency || a.left - b.left || a.name.localeCompare(b.name, "es"));
  const prep = rows.filter((r) => r.target === 0).sort((a, b) => a.name.localeCompare(b.name, "es"));

  // The honest count (Esther, Nov 3 2026): what is due this week, what is in course, what is overdue — each with its dates.
  const dueWeekGoals = outlook.sum(outlook.dueWeek);
  const inCourseGoals = outlook.sum(outlook.inCourse);
  const overdueGoals = outlook.sum(outlook.overdue);
  const inCourseRange = outlook.inCourse.length ? `${formatDayKey(outlook.inCourse[0].cycle.endKey, "d MMM")} → ${formatDayKey(outlook.inCourse[outlook.inCourse.length - 1].cycle.endKey, "d MMM")}` : "";
  const inCourseDone = outlook.inCourse.filter((s) => s.period.missing === 0 && s.period.target > 0).length;
  const totalCompleted = outlook.inCourse.reduce((n, s) => n + s.period.achieved, 0);
  const periodTarget = outlook.inCourse.reduce((n, s) => n + s.period.target, 0);
  const firstName = (n: string) => n.split(" ")[0];
  // Next two weeks vs. the team's weekly capacity.
  const dueTwoWeeks = outlook.sum(outlook.inCourse.filter((s) => s.daysLeft <= 14));
  const paceOk = pace.capacity * 2 >= dueTwoWeeks + overdueGoals;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${clients.length} clientes activos · metas por cerrar con fechas claras y el ritmo del equipo.`} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Vencen esta semana" value={dueWeekGoals} hint={outlook.dueWeek.length ? `${outlook.dueWeek.length} cliente${outlook.dueWeek.length === 1 ? "" : "s"}: ${outlook.dueWeek.slice(0, 3).map((s) => firstName(s.clientName)).join(", ")}${outlook.dueWeek.length > 3 ? "…" : ""}` : "nada vence en 7 días"} icon={<Target />} tone={dueWeekGoals > 0 ? "warning" : "success"} />
        <StatTile label="En curso" value={inCourseGoals} hint={outlook.inCourse.length ? `faltan en ${outlook.inCourse.length} período${outlook.inCourse.length === 1 ? "" : "s"} que vencen ${inCourseRange} · ${totalCompleted}/${periodTarget} cerradas · ${inCourseDone} al día` : "sin períodos en curso"} icon={<Target />} tone={inCourseGoals === 0 ? "success" : "neutral"} />
        <StatTile label="Atrasadas" value={overdueGoals} hint={outlook.overdue.length ? `${outlook.overdue.length} período${outlook.overdue.length === 1 ? "" : "s"} ya vencido${outlook.overdue.length === 1 ? "" : "s"} con metas sin cumplir` : "ningún período vencido con metas pendientes"} icon={<AlertTriangle />} tone={overdueGoals > 0 ? "danger" : "success"} />
        <StatTile label="Ritmo del equipo" value={`${pace.teamThisWeek} / ${pace.capacity}`} hint={`cerradas esta semana vs. ${WEEKLY_GOAL_TARGET} por estratega · ${paceOk ? "vamos bien" : "hay que apretar"}: ${dueTwoWeeks + overdueGoals} por cerrar en 14 días`} icon={<Gauge />} tone={paceOk ? "success" : "warning"} />
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
          <p className="eyebrow">Atrasadas · períodos vencidos con metas sin cumplir</p>
          <p className="mt-0.5 text-xs text-ink-muted">Calculado desde las agendas. Se resuelven cerrando las metas, moviendo pautas al período, o editando la meta del mes en la agenda.</p>
          {outlook.overdue.length === 0 ? <p className="mt-3 text-sm text-ink-muted">Nada atrasado.</p> : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {outlook.overdue.map((s) => (
                <li key={s.period.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                  <Link href={`/clients/${s.clientId}/agenda`} className="font-medium hover:text-accent2">{s.clientName}</Link>
                  <span className="text-xs text-ink-muted">Mes {s.period.number} · {s.period.label} · venció {formatDayKey(s.cycle.endKey, "d MMM")}</span>
                  <Badge tone="danger" size="xs" className="ml-auto">faltan {s.period.missing} de {s.period.target}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {strategistTotals.length > 0 && (
        <Card padding="none" className="mb-6 p-4 sm:p-5">
          <p className="eyebrow">Metas cerradas por estratega · período actual de cada cliente</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {strategistTotals.map(([name, goals]) => (
              <span key={name} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm", name === "Sin estratega" ? "border-dashed border-border text-ink-muted" : "border-border bg-white text-ink-primary")}>
                <span className="font-medium">{name.split(" ")[0]}</span>
                <span className="tabular text-ink-secondary">{goals}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className="border-b border-border px-5 py-3">
          <p className="eyebrow">Clientes por urgencia</p>
          <p className="mt-0.5 text-xs text-ink-muted">El período en curso de cada cliente (o el último vencido con metas pendientes). Primero los que tienen más metas pendientes con menos días.</p>
        </div>
        <ol className="divide-y divide-border">
          {active.map((r, i) => {
            const done = r.remaining === 0;
            const critical = !done && (r.left <= 7 || r.urgency >= 0.5);
            const warn = !done && !critical && r.urgency >= 0.25;
            return (
              <li key={r.id} className={cn("px-5 py-3.5", critical && "bg-red-50/50")}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="w-6 shrink-0 text-xs text-ink-muted tabular">{i + 1}</span>
                  <Link href={`/clients/${r.id}/deliverables`} className="group inline-flex w-full items-center gap-1 text-sm font-semibold text-ink-primary hover:text-accent2 sm:w-56">
                    {r.name}
                    <ArrowUpRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-accent2" />
                  </Link>
                  <div className="min-w-[200px] flex-1">
                    <DeliverablePacingBar completed={r.completed} inProgress={r.inProgress} target={r.target} />
                  </div>
                  <Badge tone={done ? "success" : critical ? "danger" : warn ? "warning" : "neutral"} size="xs" dot>
                    {done ? (r.override ? `Al día · marcado${r.override.note ? `: ${r.override.note}` : ""}` : "Al día") : r.state === "overdue" ? `Faltan ${r.remaining} · venció ${formatDayKey(r.cycle.endKey, "d MMM")}` : r.state === "future" ? `Faltan ${r.remaining} · empieza ${formatDayKey(r.cycle.startKey, "d MMM")}` : `Faltan ${r.remaining} · vence ${formatDayKey(r.cycle.endKey, "d MMM")} (${r.left} ${r.left === 1 ? "día" : "días"})`}
                  </Badge>
                  <span className="ml-auto flex items-center gap-2 text-2xs text-ink-muted">
                    {r.period ? `Mes ${r.period.number} · ${r.period.label}` : cycleLabel(r.cycle, r.cycleDay)}
                    <MonthCompleteToggle clientId={r.id} clientName={r.name} year={r.cycle.year} month={r.cycle.month} isComplete={!!r.override} note={r.override?.note ?? null} />
                  </span>
                </div>
                {r.strategists.length > 0 && (
                  <p className="mt-1.5 pl-10 text-xs text-ink-muted">
                    <span className="text-ink-secondary">Por estratega:</span>{" "}
                    {r.strategists.map((s, k) => (
                      <span key={s.name}>{k > 0 ? " · " : ""}{s.name === "Sin estratega" ? "sin estratega" : shortName(s.name, r.strategists)} <span className="tabular font-medium text-ink-primary">{s.goals}</span></span>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
          {active.length === 0 && <li className="px-5 py-6 text-sm text-ink-muted">No hay clientes activos con meta este ciclo.</li>}
        </ol>
        {prep.length > 0 && (
          <div className="border-t border-border px-5 py-3 text-xs text-ink-muted">
            Sin meta este ciclo (prep / pausa): {prep.map((r) => r.name).join(", ")}
          </div>
        )}
      </Card>
    </>
  );
}
