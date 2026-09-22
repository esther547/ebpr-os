import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthLabel } from "@/lib/utils";
import { AgencyStatsBar } from "@/components/dashboard/agency-stats-bar";
import { ClientCommandCenter } from "@/components/dashboard/client-command-center";
import { WeekCalendarStrip } from "@/components/dashboard/week-calendar-strip";
import { RunnerWeekSummary } from "@/components/dashboard/runner-week-summary";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import {
  addDaysKey,
  currentMonthYearInTz,
  dayKeyInTz,
  tzMidnight,
  weekStartKey,
} from "@/components/runners/miami-time";
import { PageHeader } from "@/components/layout/header";
import { currentCycle } from "@/lib/cycles";

export const metadata = { title: "Dashboard — EBPR OS" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  // All "what day / what week is it" logic is done in Miami time, not the
  // server's timezone (UTC on Vercel), so the week strip never shows the wrong week.
  const now = new Date();
  const { month, year } = currentMonthYearInTz(now);
  const todayKey = dayKeyInTz(now);
  const weekStartDay = weekStartKey(todayKey);
  const weekStart = tzMidnight(weekStartDay);
  const weekEnd = tzMidnight(addDaysKey(weekStartDay, 7)); // exclusive

  // ── All active clients ─────────────────────────────────────────
  const clients = await db.client.findMany({
    where: { status: { in: ["ACTIVE", "PROSPECT"] } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      monthlyTarget: true,
      cycleDay: true,
      goalsOwed: true,
      focusNote: true,
      industry: true,
      campaigns: {
        where: { status: { in: ["PREPARATION", "ACTIVE"] } },
        select: { id: true, name: true, status: true, ownerId: true },
        take: 1,
      },
      onboarding: { select: { status: true } },
    },
  });

  // ── Deliverable pacing per client for its CURRENT goal cycle (fecha de corte) ──
  const cycleByClient = new Map(clients.map((c) => [c.id, currentCycle(c.cycleDay, now)]));
  const labelSet = new Map<string, { month: number; year: number }>();
  for (const c of cycleByClient.values()) labelSet.set(`${c.year}-${c.month}`, { month: c.month, year: c.year });
  const deliverables = (
    await db.deliverable.findMany({
      where: { OR: Array.from(labelSet.values()), status: { not: "CANCELLED" } },
      select: { clientId: true, status: true, month: true, year: true },
    })
  ).filter((d) => {
    const c = cycleByClient.get(d.clientId);
    return c && c.month === d.month && c.year === d.year;
  });

  // Map clientId → { completed, inProgress, total }
  const pacingMap = new Map<
    string,
    { completed: number; inProgress: number; total: number }
  >();
  for (const d of deliverables) {
    const cur = pacingMap.get(d.clientId) ?? {
      completed: 0,
      inProgress: 0,
      total: 0,
    };
    cur.total++;
    if (d.status === "COMPLETED") cur.completed++;
    else if (!["IDEA", "CANCELLED"].includes(d.status)) cur.inProgress++;
    pacingMap.set(d.clientId, cur);
  }

  // ── Pending approvals per client ───────────────────────────────
  const pendingApprovals = await db.approval.findMany({
    where: { status: "PENDING" },
    select: { clientId: true },
  });
  const approvalsMap = new Map<string, number>();
  for (const a of pendingApprovals) {
    approvalsMap.set(a.clientId, (approvalsMap.get(a.clientId) ?? 0) + 1);
  }

  // ── Next agenda item per client (upcoming runner assignments) ──
  const upcomingAgenda = await db.runnerAssignment.findMany({
    where: {
      eventDate: { gte: now },
      status: { not: "CANCELLED" },
    },
    orderBy: { eventDate: "asc" },
    select: {
      clientId: true,
      eventName: true,
      eventDate: true,
      location: true,
    },
  });
  // Keep only the next one per client
  const nextAgendaMap = new Map<
    string,
    { eventName: string; eventDate: Date; location: string | null }
  >();
  for (const a of upcomingAgenda) {
    if (a.clientId && !nextAgendaMap.has(a.clientId)) {
      nextAgendaMap.set(a.clientId, {
        eventName: a.eventName,
        eventDate: a.eventDate,
        location: a.location,
      });
    }
  }

  // ── Assigned strategists per client (via campaign ownerId) ────
  const allUsers = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "STRATEGIST"] }, isActive: true },
    select: { id: true, name: true },
  });
  const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

  // ── This week's events (all clients) ──────────────────────────
  const weekEventRows = await db.runnerAssignment.findMany({
    where: {
      eventDate: { gte: weekStart, lt: weekEnd },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      runnerId: true,
      eventName: true,
      eventDate: true,
      location: true,
      clientId: true,
      status: true,
      runner: { select: { id: true, name: true } },
    },
    orderBy: { eventDate: "asc" },
  });
  // Attach the Miami calendar day so client components group by the same day the server did.
  const weekClientIds = Array.from(new Set(weekEventRows.map((e) => e.clientId).filter((id): id is string => !!id)));
  const weekClientNames = new Map(
    (weekClientIds.length
      ? await db.client.findMany({ where: { id: { in: weekClientIds } }, select: { id: true, name: true } })
      : []
    ).map((c) => [c.id, c.name])
  );
  const weekEvents = weekEventRows.map((e) => ({
    ...e,
    clientName: e.clientId ? weekClientNames.get(e.clientId) ?? null : null,
    dayKey: dayKeyInTz(e.eventDate),
  }));

  // ── Runner assignments this week ───────────────────────────────
  const runners = await db.user.findMany({
    where: { role: "RUNNER", isActive: true },
    select: { id: true, name: true },
  });

  // ── Agency-level stats ─────────────────────────────────────────
  const totalCompleted = deliverables.filter(
    (d) => d.status === "COMPLETED"
  ).length;
  const totalTarget = clients.reduce((s, c) => s + c.monthlyTarget, 0);
  const totalPendingApprovals = pendingApprovals.length;
  const totalEventsThisWeek = weekEvents.length;

  // ── Build enriched client rows ─────────────────────────────────
  const clientRows = clients.map((client) => {
    const pacing = pacingMap.get(client.id) ?? {
      completed: 0,
      inProgress: 0,
      total: 0,
    };
    const pendingApprovalCount = approvalsMap.get(client.id) ?? 0;
    const nextItem = nextAgendaMap.get(client.id) ?? null;
    const campaign = client.campaigns[0] ?? null;
    const strategistName = campaign?.ownerId
      ? userMap.get(campaign.ownerId) ?? null
      : null;

    return {
      ...client,
      pacing,
      pendingApprovalCount,
      nextAgendaItem: nextItem,
      activeCampaign: campaign,
      strategistName,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow={monthLabel(month, year)}
        title="Dashboard"
        subtitle={`Welcome back, ${user.name.split(" ")[0]}. Here is where every client stands this month.`}
      />

      <div className="space-y-6">
        {/* Agency stats */}
        <AgencyStatsBar
          activeClients={clients.filter((c) => c.status === "ACTIVE").length}
          totalClients={clients.length}
          deliverablesDone={totalCompleted}
          deliverablesTarget={totalTarget}
          pendingApprovals={totalPendingApprovals}
          eventsThisWeek={totalEventsThisWeek}
          month={month}
          year={year}
        />

        {/* Alerts: missing signatures, overdue payments, deliverables due this week */}
        <DashboardAlerts
          todayKey={todayKey}
          canOpenLegalFinance={user.role === "SUPER_ADMIN"}
        />

        {/* Two-column layout: main grid + right panel */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Left: client command center */}
          <ClientCommandCenter clients={clientRows} month={month} year={year} />

          {/* Right: this week + runners */}
          <div className="space-y-6">
            <WeekCalendarStrip
              events={weekEvents}
              weekStartKey={weekStartDay}
              todayKey={todayKey}
            />
            <RunnerWeekSummary
              runners={runners}
              assignments={weekEvents}
              weekStartKey={weekStartDay}
              todayKey={todayKey}
            />
          </div>
        </div>
      </div>
    </>
  );
}
