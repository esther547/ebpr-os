"use client";

import { cn } from "@/lib/utils";

type Props = {
  completed: number;
  inProgress: number;
  target: number;
};

export function DeliverablePacingBar({ completed, inProgress, target }: Props) {
  const completedPct = target > 0 ? Math.min((completed / target) * 100, 100) : 0;
  const inProgressPct =
    target > 0
      ? Math.min((inProgress / target) * 100, 100 - completedPct)
      : 0;

  const isOnTarget = completed >= target;
  const isOnTrack = completed + inProgress >= target * 0.6;

  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
        {/* Completed (solid black) */}
        <div
          className="h-full float-left rounded-l-full bg-ink-primary transition-all duration-500"
          style={{ width: `${completedPct}%` }}
        />
        {/* In progress (striped/lighter) */}
        <div
          className="h-full float-left bg-ink-primary/30 transition-all duration-500"
          style={{ width: `${inProgressPct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-medium",
            isOnTarget
              ? "text-green-700"
              : isOnTrack
              ? "text-amber-700"
              : "text-red-600"
          )}
        >
          {isOnTarget ? "On Target" : isOnTrack ? "On Track" : "Behind Pace"}
        </span>
        <span className="text-ink-muted">
          {completed}/{target}
        </span>
      </div>
    </div>
  );
}
