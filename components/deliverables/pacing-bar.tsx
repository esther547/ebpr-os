"use client";

import { Badge } from "@/components/ui/badge";

type Props = {
  completed: number;
  inProgress: number;
  target: number;
};

export function DeliverablePacingBar({ completed, inProgress, target }: Props) {
  const completedPct = target > 0 ? Math.min((completed / target) * 100, 100) : 0;
  const inProgressPct = target > 0 ? Math.min((inProgress / target) * 100, 100 - completedPct) : 0;

  const isOnTarget = completed >= target;
  const isOnTrack = completed + inProgress >= target * 0.6;

  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
        {/* Completed (solid) */}
        <div
          className="float-left h-full rounded-l-full bg-ink-primary transition-all duration-500"
          style={{ width: `${completedPct}%` }}
        />
        {/* In progress (lighter) */}
        <div
          className="float-left h-full bg-ink-primary/30 transition-all duration-500"
          style={{ width: `${inProgressPct}%` }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <Badge size="xs" tone={isOnTarget ? "success" : isOnTrack ? "warning" : "danger"} dot>
          {isOnTarget ? "On Target" : isOnTrack ? "On Track" : "Behind Pace"}
        </Badge>
        <span className="tabular text-xs text-ink-muted">
          {completed}/{target}
        </span>
      </div>
    </div>
  );
}
