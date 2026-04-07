import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentMonthYear, monthLabel } from "@/lib/utils";
import { AgencyStatsBar } from "@/components/dashboard/agency-stats-bar";
import { ClientCommandCenter } from "@/components/dashboard/client-command-center";
import { WeekCalendarStrip } from "@/components/dashboard/week-calendar-strip";
import { RunnerWeekSummary } from "@/components/dashboard/runner-week-summary";
import { startOfWeek, endOfWeek } from "date-fns";
import { EBPRLogoHorizontal } from "@/components/brand/ebpr-logo";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export const metadata = { title: "Dashboard — EBPR OS" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const { month, year } = currentMonthYear();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

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
      industry: true,
      campaigns: {
        where: { status: { in: ["PREPARATION", "ACTIVE"] } },
        select: { id: true, name: true, status: true, ownerId: true },
        take: 1,
      },
      onboarding: { select: { status: true } },
      _count: {
        select: { approvals: true },
      },
    },
  });

  // ── Deliverable pacing for all clients this month ──────────────
  const deliverables = await db.deliverable.findMany({
    where: { month, year, status: { not: "CANCELLED" } },
    select: { clientId: true, status: true },
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
  const weekEvents = await db.runnerAssignment.findMany({
    where: {
      eventDate: { gte: weekStart, lte: weekEnd },
      status: { not: "CANCELLED" },
    },
    include: {
      runner: { select: { id: true, name: true } },
    },
    orderBy: { eventDate: "asc" },
  });

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
    <div className="min-h-screen bg-surface-1">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <EBPRLogoHorizontal size="sm" />
            <span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
              OS
            </span>
            <span className="h-4 w-px bg-border" />
            <span className="text-sm font-medium text-ink-secondary">
              {monthLabel(month, year)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1">
              {[
                { href: "/clients", label: "Clients" },
                { href: "/legal", label: "Legal" },
                { href: "/finance", label: "Finance" },
                { href: "/runners/schedule", label: "Runners" },
                { href: "/reports", label: "Reports" },
                { href: "/settings", label: "Settings" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1 rounded-md text-xs font-medium text-ink-muted hover:text-ink-primary hover:bg-surface-2 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="h-4 w-px bg-border" />
            <span className="text-sm text-ink-muted">{user.name.split(" ")[0]}</span>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </header>

      <div className="px-6 pb-16 pt-6 max-w-[1600px] mx-auto">
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

        {/* Two-column layout: main grid + right panel */}
        <div className="mt-8 grid grid-cols-[1fr_320px] gap-6 items-start">
          {/* Left: client command center */}
          <ClientCommandCenter clients={clientRows} month={month} year={year} />

          {/* Right: this week + runners */}
          <div className="space-y-6">
            <WeekCalendarStrip
              events={weekEvents}
              weekStart={weekStart}
            />
            <RunnerWeekSummary
              runners={runners}
              assignments={weekEvents}
              weekStart={weekStart}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
