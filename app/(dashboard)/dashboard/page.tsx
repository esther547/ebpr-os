import Link from "next/link";
import { ArrowUpRight, Target, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentPeriodProgress } from "@/lib/service-periods";
import { isClosedGoal, isOpenGoal } from "@/lib/goal-status";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/header";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeliverablePacingBar } from "@/components/deliverables/pacing-bar";
import { MonthCompleteToggle } from "@/components/dashboard/month-complete-toggle";
import { currentCycle, cycleForLabel, cycleLabel } from "@/lib/cycles";
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

  // Service periods: each client's CURRENT period (the latest one) — the same progress the agenda shows.
  const current = await currentPeriodProgress(clients.map((c) => c.id));

  // Who closed what in each client's current period (Esther, Oct 6 2026: "cuántas son por estratega").
  const goalIds = [...current.values()].flatMap((p) => p.units.map((u) => u.goalId).filter((x): x is string => !!x));
  const closers = new Map((await db.deliverable.findMany({ where: { id: { in: goalIds } }, select: { id: true, closedBy: { select: { name: true } }, assignee: { select: { name: true } } } })).map((g) => [g.id, g.closedBy?.name ?? g.assignee?.name ?? null]));
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
    const cycle = cur ? cycleForLabel(c.cycleDay, cur.refYear, cur.refMonth) : cycleByClient.get(c.id)!;
    const p0 = pacing.get(c.id) ?? { completed: 0, inProgress: 0 };
    const p = { ...p0, completed: cur ? cur.achieved : p0.completed };
    if (cur) c = { ...c, monthlyTarget: cur.target };
    const target = c.monthlyTarget + (c.goalsOwed ?? 0);
    const override = overrideOf(c.id, cycle.year, cycle.month);
    const remaining = override ? 0 : Math.max(0, target - p.completed);
    const left = daysLeft(cycle.endKey);
    // Urgency: goals still missing per day left (more missing + fewer days = more urgent).
    const urgency = remaining === 0 ? -1 : remaining / Math.max(left, 1);
    return { ...c, cycle, completed: p.completed, inProgress: p.inProgress, target, remaining, left, urgency, override, period: cur ?? null, strategists: perClient.get(c.id) ?? [] };
  });

  const active = rows.filter((r) => r.target > 0).sort((a, b) => b.urgency - a.urgency || a.left - b.left || a.name.localeCompare(b.name, "es"));
  const prep = rows.filter((r) => r.target === 0).sort((a, b) => a.name.localeCompare(b.name, "es"));

  // Specific numbers (Esther, Oct 6 2026): this period's goals vs. goals owed from earlier months,
  // how many clients are complete, and what is due within a week.
  const totalCompleted = rows.reduce((s, r) => s + r.completed, 0);
  const periodTarget = active.reduce((s, r) => s + r.monthlyTarget, 0);
  const owed = active.reduce((s, r) => s + (r.goalsOwed ?? 0), 0);
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);
  const clientsDone = active.filter((r) => r.remaining === 0).length;
  const dueSoon = active.filter((r) => r.remaining > 0 && r.left <= 7);
  const dueSoonGoals = dueSoon.reduce((s, r) => s + r.remaining, 0);
  const nextDue = active.filter((r) => r.remaining > 0).sort((a, b) => a.left - b.left)[0];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Clientes activos y entregables del ciclo actual, ordenados por urgencia." />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Clientes activos" value={clients.length} hint={`${active.length} con meta este período · ${clientsDone} al día`} icon={<Users />} />
        <StatTile
          label="Metas del período actual"
          value={`${totalCompleted} / ${periodTarget}`}
          hint={`cerradas en ${active.length} clientes${owed ? ` · más ${owed} debida${owed === 1 ? "" : "s"} de meses anteriores` : ""}`}
          icon={<Target />}
          tone={totalRemaining === 0 ? "success" : "neutral"}
        />
        <StatTile
          label="Faltan por cerrar"
          value={totalRemaining}
          hint={owed ? `${Math.max(0, totalRemaining - owed)} del período + ${owed} debidas` : "en los períodos en curso"}
          icon={<Target />}
          tone={totalRemaining === 0 ? "success" : "neutral"}
        />
        <StatTile
          label="Vencen en 7 días"
          value={dueSoonGoals}
          hint={dueSoon.length ? `${dueSoon.length} cliente${dueSoon.length === 1 ? "" : "s"}: ${dueSoon.slice(0, 3).map((r) => r.name.split(" ")[0]).join(", ")}${dueSoon.length > 3 ? "…" : ""}` : nextDue ? `próximo: ${nextDue.name.split(" ")[0]} vence ${formatDayKey(nextDue.cycle.endKey, "d MMM")}` : "nada pendiente"}
          icon={<Target />}
          tone={dueSoonGoals > 0 ? "warning" : "success"}
        />
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
          <p className="mt-0.5 text-xs text-ink-muted">Primero los que tienen más metas pendientes con menos días de ciclo.</p>
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
                  {r.goalsOwed ? <span className="text-xs text-ink-muted">incl. {r.goalsOwed} {r.goalsOwed === 1 ? "debida" : "debidas"}</span> : null}
                  <Badge tone={done ? "success" : critical ? "danger" : warn ? "warning" : "neutral"} size="xs" dot>
                    {done ? (r.override ? `Al día · marcado${r.override.note ? `: ${r.override.note}` : ""}` : "Al día") : `Faltan ${r.remaining} · vence ${formatDayKey(r.cycle.endKey, "d MMM")} (${r.left} ${r.left === 1 ? "día" : "días"})`}
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
                      <span key={s.name}>{k > 0 ? " · " : ""}{s.name === "Sin estratega" ? "sin estratega" : s.name.split(" ")[0]} <span className="tabular font-medium text-ink-primary">{s.goals}</span></span>
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
