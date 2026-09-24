import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, CheckCircle2, Users, TrendingUp, Building2 } from "lucide-react";
import type { DeliverableType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { dayKeyInTz } from "@/components/runners/miami-time";
import { PageHeader, SectionHeader } from "@/components/layout/header";
import { StatTile } from "@/components/ui/stat-tile";
import { TableWrap, Table, Th, Td, TableEmpty } from "@/components/ui/table";
import { StrategistGoalsTable, type StrategistRow } from "@/components/reports/strategist-goals-table";
import {
  TYPE_LABELS_ES,
  initialsOf,
  loadActiveStrategists,
  loadClosedGoals,
  resolveRange,
} from "@/lib/strategist-report";

export const metadata = { title: "Metas por estratega" };
export const dynamic = "force-dynamic";

// Server component: buttonVariants lives in a client module, so link-buttons use these
// class strings (they match buttonVariants secondary/ghost at size "sm").
const LINK_BTN =
  "inline-flex h-8 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/25 focus-visible:ring-offset-2";
const LINK_BTN_SECONDARY = `${LINK_BTN} border border-border bg-white text-ink-primary shadow-sm hover:border-border-strong hover:bg-surface-2`;
const LINK_BTN_GHOST = `${LINK_BTN} text-ink-secondary hover:bg-surface-2 hover:text-ink-primary`;

const shortDate = new Intl.DateTimeFormat("es", {
  timeZone: "America/New_York",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const BASE = "/reports/strategists";

export default async function StrategistReportPage({
  searchParams,
}: {
  searchParams?: { week?: string; month?: string };
}) {
  const user = await requireUser();
  if (!canViewReports(user)) redirect("/dashboard");

  const range = resolveRange(searchParams ?? {});
  const [goals, strategists] = await Promise.all([
    loadClosedGoals(range.fromKey, range.toKey),
    loadActiveStrategists(),
  ]);

  // ─── Per strategist ────────────────────────────────────
  type Acc = {
    id: string | null;
    name: string;
    goals: typeof goals;
  };
  const byCloser = new Map<string, Acc>();
  for (const s of strategists) byCloser.set(s.id, { id: s.id, name: s.name, goals: [] });
  const unassigned: Acc = { id: null, name: "Sin estratega", goals: [] };
  for (const g of goals) {
    if (!g.closedBy) {
      unassigned.goals.push(g);
      continue;
    }
    // Anyone who closed something in range shows up, even if no longer active.
    const acc = byCloser.get(g.closedBy.id) ?? { id: g.closedBy.id, name: g.closedBy.name, goals: [] };
    acc.goals.push(g);
    byCloser.set(g.closedBy.id, acc);
  }

  function toRow(acc: Acc): StrategistRow {
    const typeCounts = new Map<DeliverableType, number>();
    for (const g of acc.goals) typeCounts.set(g.type, (typeCounts.get(g.type) ?? 0) + 1);
    return {
      key: acc.id ?? "none",
      name: acc.name,
      initials: acc.id ? initialsOf(acc.name) : "—",
      unassigned: acc.id === null,
      count: acc.goals.length,
      clients: new Set(acc.goals.map((g) => g.client.id)).size,
      byType: Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ label: TYPE_LABELS_ES[type] ?? type, count })),
      goals: acc.goals.map((g) => ({
        id: g.id,
        clientId: g.client.id,
        clientName: g.client.name,
        title: g.title,
        typeLabel: TYPE_LABELS_ES[g.type] ?? g.type,
        dateLabel: (g.closedAt ?? g.completedAt) ? shortDate.format((g.closedAt ?? g.completedAt) as Date) : "—",
      })),
    };
  }

  const strategistAccs = Array.from(byCloser.values()).sort(
    (a, b) => b.goals.length - a.goals.length || a.name.localeCompare(b.name, "es")
  );
  const rows: StrategistRow[] = strategistAccs.map(toRow);
  if (unassigned.goals.length > 0) rows.push(toRow(unassigned));

  // ─── Stats ─────────────────────────────────────────────
  const total = goals.length;
  const activeCount = strategists.length;
  const withGoals = strategistAccs.filter((a) => a.goals.length > 0).length;
  const attributed = total - unassigned.goals.length;
  const average = activeCount > 0 ? attributed / activeCount : 0;
  const clientCount = new Set(goals.map((g) => g.client.id)).size;

  // ─── Client × strategist ───────────────────────────────
  const columns = [
    ...strategistAccs.filter((a) => a.goals.length > 0).map((a) => ({ key: a.id as string, name: a.name })),
    ...(unassigned.goals.length > 0 ? [{ key: "none", name: "Sin estratega" }] : []),
  ];
  const clientMap = new Map<string, { id: string; name: string; total: number; cells: Map<string, number> }>();
  for (const g of goals) {
    const row = clientMap.get(g.client.id) ?? { id: g.client.id, name: g.client.name, total: 0, cells: new Map() };
    const key = g.closedBy?.id ?? "none";
    row.cells.set(key, (row.cells.get(key) ?? 0) + 1);
    row.total += 1;
    clientMap.set(g.client.id, row);
  }
  const clientRows = Array.from(clientMap.values()).sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, "es")
  );

  // ─── Navigation ────────────────────────────────────────
  const param = range.mode === "week" ? "week" : "month";
  const href = (value: string) => `${BASE}?${param}=${value}`;
  // Switching mode keeps you near the range you are looking at.
  const weekHref = range.mode === "week" ? null : range.isCurrent ? BASE : `${BASE}?week=${range.fromKey}`;
  const currentMonth = dayKeyInTz(new Date()).slice(0, 7); // "yyyy-MM" in Miami
  const monthHref =
    range.mode === "month" ? null : `${BASE}?month=${range.isCurrent ? currentMonth : range.fromKey.slice(0, 7)}`;
  const thisRangeHref = range.mode === "week" ? BASE : `${BASE}?month=${currentMonth}`;
  const exportHref = `/api/reports/strategists/export?from=${range.fromKey}&to=${range.toKey}`;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Reports", href: "/reports" }, { label: "Metas por estratega" }]}
        eyebrow={range.label}
        title="Metas por estratega"
        subtitle="Metas cerradas por cada estratega, según la fecha de cierre (hora de Miami)."
        actions={
          <>
            <div className="inline-flex h-9 items-center gap-1 rounded-lg bg-surface-2 p-1" role="tablist" aria-label="Rango">
              <RangeTab href={weekHref} active={range.mode === "week"}>
                Semana
              </RangeTab>
              <RangeTab href={monthHref} active={range.mode === "month"}>
                Mes
              </RangeTab>
            </div>
            <a href={exportHref} download className={LINK_BTN_SECONDARY}>
              <Download className="h-3.5 w-3.5" />
              Descargar CSV
            </a>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={href(range.prevParam)}
            aria-label={range.mode === "week" ? "Semana anterior" : "Mes anterior"}
            className={cn(LINK_BTN_SECONDARY, "w-8 px-0")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={href(range.nextParam)}
            aria-label={range.mode === "week" ? "Semana siguiente" : "Mes siguiente"}
            className={cn(LINK_BTN_SECONDARY, "w-8 px-0")}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          {!range.isCurrent && (
            <Link href={thisRangeHref} className={LINK_BTN_GHOST}>
              {range.mode === "week" ? "Esta semana" : "Este mes"}
            </Link>
          )}
        </div>
      </PageHeader>

      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile
            label="Metas cerradas"
            value={total}
            hint={range.mode === "week" ? "en la semana" : "en el mes"}
            icon={<CheckCircle2 />}
          />
          <StatTile
            label="Estrategas activos"
            value={activeCount}
            hint={`${withGoals} con metas cerradas`}
            icon={<Users />}
          />
          <StatTile
            label="Promedio por estratega"
            value={average.toLocaleString("es", { maximumFractionDigits: 1 })}
            hint={unassigned.goals.length > 0 ? `${unassigned.goals.length} sin estratega` : "metas por persona"}
            tone={unassigned.goals.length > 0 ? "warning" : "neutral"}
            icon={<TrendingUp />}
          />
          <StatTile
            label="Clientes con metas"
            value={clientCount}
            hint="con al menos una meta cerrada"
            icon={<Building2 />}
          />
        </div>

        <section>
          <SectionHeader
            title="Por estratega"
            description="Toca “Ver” para ver las metas que cerró cada persona."
          />
          <StrategistGoalsTable rows={rows} />
        </section>

        <section>
          <SectionHeader title="Por cliente" description="Metas cerradas por cliente y estratega en el rango." />
          <TableWrap>
            <Table style={{ minWidth: `${Math.max(480, 220 + (columns.length + 1) * 110)}px` }}>
              <thead>
                <tr>
                  <Th className="left-0 z-20">Cliente</Th>
                  {columns.map((c) => (
                    <Th key={c.key} align="right">
                      {c.name}
                    </Th>
                  ))}
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {clientRows.map((c) => (
                  <tr key={c.id}>
                    <Td className="sticky left-0 bg-white font-medium">
                      <Link href={`/clients/${c.id}/deliverables`} className="hover:underline">
                        {c.name}
                      </Link>
                    </Td>
                    {columns.map((col) => {
                      const n = c.cells.get(col.key) ?? 0;
                      return (
                        <Td key={col.key} align="right" numeric className={n === 0 ? "text-ink-muted" : "font-medium"}>
                          {n === 0 ? "·" : n}
                        </Td>
                      );
                    })}
                    <Td align="right" numeric className="font-semibold">
                      {c.total}
                    </Td>
                  </tr>
                ))}
                {clientRows.length === 0 && (
                  <TableEmpty colSpan={columns.length + 2}>
                    No se cerraron metas {range.mode === "week" ? "esta semana" : "este mes"}.
                  </TableEmpty>
                )}
              </tbody>
            </Table>
          </TableWrap>
        </section>
      </div>
    </>
  );
}

function RangeTab({ href, active, children }: { href: string | null; active: boolean; children: React.ReactNode }) {
  const cls = cn(
    "inline-flex h-7 items-center rounded-md px-3 text-xs font-medium transition-all",
    active ? "bg-white text-ink-primary shadow-sm" : "text-ink-secondary hover:text-ink-primary"
  );
  if (!href || active) {
    return (
      <span role="tab" aria-selected={active} className={cls}>
        {children}
      </span>
    );
  }
  return (
    <Link role="tab" aria-selected={false} href={href} className={cls}>
      {children}
    </Link>
  );
}
