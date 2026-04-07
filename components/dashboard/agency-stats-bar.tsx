"use client";

import { cn, monthLabel } from "@/lib/utils";

type Props = {
  activeClients: number;
  totalClients: number;
  deliverablesDone: number;
  deliverablesTarget: number;
  pendingApprovals: number;
  eventsThisWeek: number;
  month: number;
  year: number;
};

export function AgencyStatsBar({
  activeClients,
  totalClients,
  deliverablesDone,
  deliverablesTarget,
  pendingApprovals,
  eventsThisWeek,
  month,
  year,
}: Props) {
  const pct =
    deliverablesTarget > 0
      ? Math.round((deliverablesDone / deliverablesTarget) * 100)
      : 0;

  const stats = [
    {
      label: "Active Clients",
      value: String(activeClients),
      sub: `of ${totalClients} total`,
      accent: false,
    },
    {
      label: `Deliverables — ${monthLabel(month, year)}`,
      value: `${deliverablesDone}/${deliverablesTarget}`,
      sub: `${pct}% complete`,
      accent: pct >= 80,
      warn: pct < 50 && deliverablesTarget > 0,
    },
    {
      label: "Pending Approvals",
      value: String(pendingApprovals),
      sub: pendingApprovals > 0 ? "action required" : "all clear",
      urgent: pendingApprovals > 0,
    },
    {
      label: "Events This Week",
      value: String(eventsThisWeek),
      sub: "scheduled appearances",
      accent: false,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={cn(
            "rounded-lg border bg-white px-5 py-4",
            stat.urgent
              ? "border-ink-primary"
              : stat.accent
              ? "border-green-200"
              : "border-border"
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {stat.label}
          </p>
          <p
            className={cn(
              "mt-1.5 text-3xl font-bold tabular-nums",
              stat.urgent
                ? "text-ink-primary"
                : stat.accent
                ? "text-green-700"
                : "text-ink-primary"
            )}
          >
            {stat.value}
          </p>
          <p
            className={cn(
              "mt-0.5 text-xs",
              stat.urgent
                ? "font-medium text-ink-primary"
                : stat.warn
                ? "text-red-600"
                : "text-ink-muted"
            )}
          >
            {stat.sub}
          </p>
        </div>
      ))}
    </div>
  );
}
