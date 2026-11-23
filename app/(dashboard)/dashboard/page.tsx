import Link from "next/link";
import { shortName } from "@/lib/short-name";
import { ArrowUpRight, CalendarClock, Gauge, Target, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamPace, WEEKLY_GOAL_TARGET } from "@/lib/dashboard-goals";
import { closingBoard, weeklyDue, GOAL_CLOSING, type ClosingRow } from "@/lib/goal-closing";
import { canManageClients } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/header";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClosingEdit } from "@/components/dashboard/closing-edit";
import { dayKeyInTz, formatDayKey } from "@/components/runners/miami-time";

export const metadata = { title: "Dashboard — EBPR OS" };
export const dynamic = "force-dynamic";

/**
 * Dashboard (Esther, Nov 16 2026): the year closes on Dec 15. One count — the goals each active client is
 * still owed until that day, as she counted them — plus the pace the team needs and the pace it has.
 * The earlier period-by-period count (overdue / in course) was retired at her request.
 * Nov 23 2026: once clients carry a December number the count shows in two parts — November (due Nov 30) and
 * December (due Dec 15) — so December is billed before its goals are worked ("separar noviembre y diciembre").
 * A client's December goals show "En espera" while it has a billing day; that day itself is for admins only.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const canEdit = canManageClients(user);
  const now = new Date();

  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, closingOwed: true, closingOwedDec: true, closingBillKey: true, closingNote: true, closingHold: true },
    orderBy: { name: "asc" },
  });
  const [closing, pace] = await Promise.all([closingBoard(clients, now), teamPace(now)]);
  const each = await weeklyDue(closing, now);
  // A fixed personal number (Verónica's) is shown only to that person and to Esther.
  const dueOf = (id: string) => { const d = each.rows.get(id); return d && (!d.isPrivate || user.role === "SUPER_ADMIN" || user.id === id) ? d : null; };

  const { dueLabel, dueShort, sinceShort, novDueLabel, novDueShort } = GOAL_CLOSING;
  const split = closing.split;
  const inNov = closing.phase === "nov";
  const isAdmin = user.role === "SUPER_ADMIN";
  const todayKey = dayKeyInTz(now);
  // What the team can close right now: everything except the December goals still waiting to be billed.
  const workable = closing.pending - (split ? closing.decWaiting.pending : 0);
  const weeksLeft = Math.max(1, closing.daysLeft / 7);
  // November has its own, earlier deadline: its goals are spread over the days left to it.
  const perWeek = split && inNov ? Math.ceil(closing.nov.pending / Math.max(1, closing.nov.daysLeft / 7)) + Math.ceil(closing.decOpen.pending / weeksLeft) : Math.ceil(workable / weeksLeft);
  const pendingNow = (r: ClosingRow) => (split ? r.pendingNov + (r.billKey ? 0 : r.pendingDec) : r.pending);
  const owing = closing.rows.filter((r) => r.pendingNov > 0).sort((a, b) => b.pendingNov - a.pendingNov || b.owedNov - a.owedNov || a.name.localeCompare(b.name, "es"));
  // December: first what can be worked, then what waits.
  const december = closing.rows.filter((r) => r.owedDec > 0).sort((a, b) => Number(!!a.billKey) - Number(!!b.billKey) || b.pendingDec - a.pendingDec || a.name.localeCompare(b.name, "es"));
  const upToDate = closing.rows.filter((r) => pendingNow(r) === 0);
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const dayLabel = (key: string) => `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
  /** Admins only: when December is billed (amber once the day has passed and it is still not marked as billed). */
  const billing = (r: ClosingRow) => isAdmin && r.billKey && (
    <span className={r.billKey < todayKey ? "font-medium text-amber-700" : "text-ink-secondary"}>Cobro {dayLabel(r.billKey)}{r.billKey < todayKey ? " · ya pasó: si cobraste, bórrala en el lápiz" : ""}</span>
  );
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const edit = (r: ClosingRow) => canEdit && <ClosingEdit clientId={r.id} clientName={r.name} pending={r.pendingNov} pendingDec={split ? r.pendingDec : null} closed={r.closed} owedNov={r.owedNov} note={r.note} hold={r.hold} dueLabel={dueLabel} split={split} billKey={isAdmin ? r.billKey : null} canBill={isAdmin} />;

  /** One client line of a part of the count: November (or the whole count while it is not split) or December. */
  const clientRow = (r: ClosingRow, i: number, part: "nov" | "dec") => {
    const owed = part === "dec" ? r.owedDec : r.owedNov;
    const done = part === "dec" ? r.advancedDec : Math.min(r.closed, r.owedNov);
    const pending = part === "dec" ? r.pendingDec : r.pendingNov;
    const pct = owed > 0 ? Math.min(100, Math.round((done / owed) * 100)) : 0;
    const waiting = part === "dec" && !!r.billKey;
    const bill = billing(r);
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
            <span className="text-xs text-ink-muted tabular">{done} de {owed} {waiting ? plural(done, "adelantada", "adelantadas") : plural(done, "cerrada", "cerradas")}</span>
            <Badge tone={pending === 0 ? "success" : waiting ? "neutral" : pending >= 15 ? "danger" : pending >= 8 ? "warning" : "neutral"} size="xs" dot>{pending === 0 ? "Completo" : waiting ? `En espera · ${pending}` : `Faltan ${pending}`}</Badge>
            {edit(r)}
          </span>
        </div>
        {part === "dec" && bill && <p className="mt-1 pl-10 text-xs text-ink-muted">{bill}</p>}
        {part === "nov" && (r.note || r.strategists.length > 0 || (bill && r.owedDec === 0)) && (
          <p className="mt-1 pl-10 text-xs text-ink-muted">
            {bill && r.owedDec === 0 && <>{bill}{r.note || r.strategists.length > 0 ? " · " : ""}</>}
            {r.note}
            {r.note && r.strategists.length > 0 ? " · " : ""}
            {r.strategists.length > 0 && <><span className="text-ink-secondary">Cerradas por:</span>{" "}{r.strategists.map((s, k) => (
              <span key={s.name}>{k > 0 ? " · " : ""}{s.name === "Sin estratega" ? "sin estratega" : shortName(s.name, r.strategists)} <span className="tabular font-medium text-ink-primary">{s.goals}</span></span>
            ))}</>}
          </p>
        )}
      </li>
    );
  };

  const novemberCard = (
    <Card padding="none" className="mb-6" key="nov">
      <div className="border-b border-border px-5 py-3">
        <p className="eyebrow">{split ? `Noviembre · metas que se deben al ${novDueLabel}` : `Metas que se deben al ${dueLabel}`} · por cliente</p>
        <p className="mt-0.5 text-xs text-ink-muted">{split && !inNov ? "Lo que quedó de noviembre se cierra antes que lo de diciembre. " : ""}El número de cada cliente baja solo cuando se cierra una meta nueva. Primero los que más deben.</p>
      </div>
      <ol className="divide-y divide-border">
        {owing.map((r, i) => clientRow(r, i, "nov"))}
        {owing.length === 0 && <li className="px-5 py-6 text-sm text-ink-muted">{closing.rows.length ? (split ? "Noviembre está completo en todos los clientes." : "Todos los clientes están al día.") : "Todavía no hay metas cargadas para el cierre."}</li>}
      </ol>
    </Card>
  );
  const decemberCard = split && (
    <Card padding="none" className="mb-6" key="dec">
      <div className="border-b border-border px-5 py-3">
        <p className="eyebrow">Diciembre · metas que se deben al {dueLabel} · por cliente</p>
        <p className="mt-0.5 text-xs text-ink-muted">Las que dicen «En espera» todavía no se trabajan. Una meta nueva paga primero lo que el cliente deba de noviembre; solo lo que sobra baja aquí.</p>
      </div>
      <ol className="divide-y divide-border">
        {december.map((r, i) => clientRow(r, i, "dec"))}
        {december.length === 0 && <li className="px-5 py-6 text-sm text-ink-muted">Ningún cliente tiene metas de diciembre cargadas.</li>}
      </ol>
    </Card>
  );

  return (
    <>
      <PageHeader title="Dashboard" subtitle={split ? `${clients.length} clientes activos · ${GOAL_CLOSING.label}: noviembre cierra el ${novDueLabel}; diciembre, el ${dueLabel}.` : `${clients.length} clientes activos · ${GOAL_CLOSING.label}: cerramos el ${dueLabel}.`} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {split ? (
          <>
            <StatTile label={`Noviembre · al ${novDueShort}`} value={closing.nov.pending} hint={inNov ? `por cerrar, de ${closing.nov.owed} · ${closing.nov.closed} ${plural(closing.nov.closed, "cerrada", "cerradas")} · quedan ${closing.nov.daysLeft} ${plural(closing.nov.daysLeft, "día", "días")}` : closing.nov.pending ? "quedaron de noviembre: se cierran antes que las de diciembre" : `noviembre completo: ${closing.nov.owed} de ${closing.nov.owed}`} icon={<Target />} tone={closing.nov.pending === 0 ? "success" : inNov ? "neutral" : "warning"} />
            <StatTile label={`Diciembre · al ${dueShort}`} value={closing.decOpen.pending} hint={`ya se pueden trabajar, de ${closing.decOpen.owed} · quedan ${closing.daysLeft} ${plural(closing.daysLeft, "día", "días")}${closing.decWaiting.pending ? ` · ${closing.decWaiting.pending} más en espera: no se adelantan` : ""}`} icon={<CalendarClock />} tone={closing.decOpen.pending === 0 && closing.decOpen.owed > 0 ? "success" : "neutral"} />
          </>
        ) : (
          <>
            <StatTile label={`Por cerrar al ${dueShort}`} value={closing.pending} hint={`de ${closing.owed} contadas el ${sinceShort} · ${closing.closed} cerrada${closing.closed === 1 ? "" : "s"} desde entonces`} icon={<Target />} tone={closing.pending === 0 ? "success" : "neutral"} />
            <StatTile label="Días que quedan" value={closing.daysLeft} hint={`${Math.round(weeksLeft * 10) / 10} semanas hasta el ${dueLabel}`} icon={<CalendarClock />} tone={closing.daysLeft <= 7 ? "warning" : "neutral"} />
          </>
        )}
        <StatTile label="Cada estratega, por semana" value={each.base} hint={split && inNov ? `Esta semana cada estratega debe cerrar ${each.base}: su parte de noviembre (al ${novDueLabel}) y de lo abierto de diciembre. Lo que no cierre pasa a su semana siguiente` : `Cada estratega debe cerrar ${each.base} a la semana para que de acá al ${dueLabel} se cumpla todo. Lo que no cierre pasa a su semana siguiente`} icon={<TrendingUp />} tone="neutral" />
        <StatTile label="Cerradas esta semana" value={`${pace.teamThisWeek} / ${perWeek}`} hint="lo que lleva el equipo vs. lo que hace falta por semana" icon={<Gauge />} tone={pace.teamThisWeek >= perWeek ? "success" : "warning"} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card padding="none" className="p-4 sm:p-5">
          <p className="eyebrow">Ritmo semanal · {formatDayKey(pace.weekStart, "d MMM")} – {formatDayKey(pace.weekEnd, "d MMM")}</p>
          <p className="mt-0.5 text-xs text-ink-muted">Lo que lleva cada quien y lo que le toca esta semana. Lo que alguien no cierra no se reparte: pasa a su propia semana siguiente.</p>
          <ul className="mt-3 space-y-2.5">
            {pace.rows.map((r) => { const d = dueOf(r.id); const ref = Math.max(1, d ? d.due : each.base || WEEKLY_GOAL_TARGET); const pct = Math.min(100, Math.round((r.thisWeek / ref) * 100)); return (
              <li key={r.id} className="text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate font-medium">{shortName(r.name, pace.rows)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${d && d.carried > 0 && d.missing > 0 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div>
                  <span className="w-16 shrink-0 text-right tabular"><span className="font-semibold">{r.thisWeek}</span>{d && <span className="text-xs text-ink-muted"> de {d.due}</span>}</span>
                </div>
                {d && (
                  <p className="mt-0.5 pl-[7.75rem] text-xs text-ink-muted">
                    {d.carried > 0 && <span className="text-amber-700">Le tocan {d.due}: {d.due > d.carried ? `${d.due - d.carried} de la semana + ` : ""}{d.carried} que no cerró antes. </span>}
                    {d.missing === 0 ? <span className="text-emerald-700">Cumplió su semana.</span> : each.isLastWeek ? <>Le faltan {d.missing} para el {dueLabel}.</> : <>Le faltan {d.missing}. Si no las cierra, la próxima semana le tocan <span className="font-medium text-ink-primary">{d.next}</span>.</>}
                  </p>
                )}
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
                      {edit(r)}
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
                      {edit(r)}
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
                      {canEdit && <ClosingEdit clientId={c.id} clientName={c.name} pending={null} closed={0} note={null} hold={false} dueLabel={dueLabel} split={split} />}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {split && !inNov ? [decemberCard, novemberCard] : [novemberCard, decemberCard]}
    </>
  );
}
