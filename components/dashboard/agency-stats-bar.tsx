"use client";

import { monthLabel } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import { Users, CheckCircle2, Clock, CalendarDays } from "lucide-react";

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

  const deliverableTone =
    deliverablesTarget > 0 && pct < 50 ? "danger" : pct >= 80 ? "success" : "neutral";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Active Clients"
        value={activeClients}
        hint={`of ${totalClients} total`}
        icon={<Users />}
      />
      <StatTile
        label={`Deliverables — ${monthLabel(month, year)}`}
        value={`${deliverablesDone}/${deliverablesTarget}`}
        hint={`${pct}% complete`}
        tone={deliverableTone}
        icon={<CheckCircle2 />}
      />
      <StatTile
        label="Pending Approvals"
        value={pendingApprovals}
        hint={pendingApprovals > 0 ? "Action required" : "All clear"}
        tone={pendingApprovals > 0 ? "warning" : "success"}
        icon={<Clock />}
      />
      <StatTile
        label="Events This Week"
        value={eventsThisWeek}
        hint="Scheduled appearances"
        icon={<CalendarDays />}
      />
    </div>
  );
}
