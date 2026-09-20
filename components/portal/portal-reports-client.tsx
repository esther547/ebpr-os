"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DELIVERABLE_TYPE_LABELS, monthLabel } from "@/lib/utils";
import { Trophy, Target, TrendingUp, ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, statusTone, humanize } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type Deliverable = {
  id: string;
  title: string;
  type: string;
  status: string;
  outcome: string | null;
  completedAt: string | null;
};

interface Props {
  clientName: string;
  monthlyTarget: number;
  deliverables: Deliverable[];
  month: number;
  year: number;
  currentMonth: number;
  currentYear: number;
}

export function PortalReportsClient({
  clientName,
  monthlyTarget,
  deliverables,
  month,
  year,
  currentMonth,
  currentYear,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<{ month: number; year: number } | null>(null);

  const isCurrentMonth = month === currentMonth && year === currentYear;

  function navigate(m: number, y: number) {
    setTarget({ month: m, year: y });
    startTransition(() => {
      router.push(`/portal/reports?month=${m}&year=${y}`);
    });
  }

  function prevMonth() {
    if (month === 1) navigate(12, year - 1);
    else navigate(month - 1, year);
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 12) navigate(1, year + 1);
    else navigate(month + 1, year);
  }

  const shown = pending && target ? target : { month, year };

  const completed = deliverables.filter((d) => d.status === "COMPLETED");
  const inProgress = deliverables.filter((d) =>
    ["OUTREACH", "CONFIRMED", "IN_PROGRESS"].includes(d.status)
  );

  const completionRate = monthlyTarget > 0
    ? Math.round((completed.length / monthlyTarget) * 100)
    : 0;

  // Type breakdown
  const typeBreakdown = completed.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const breakdownRows = Object.entries(typeBreakdown)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const breakdownMax = breakdownRows.length > 0 ? breakdownRows[0].count : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        className="pt-0 pb-0 sm:pt-0"
        title="Monthly Report"
        subtitle={clientName}
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-1 shadow-card">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={prevMonth}
              disabled={pending}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-medium text-ink-primary tabular">
              {monthLabel(shown.month, shown.year)}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={nextMonth}
              disabled={isCurrentMonth || pending}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {pending ? (
        <div className="space-y-6" aria-busy="true">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="Wins Delivered"
              value={completed.length}
              icon={<Trophy />}
              tone={completed.length >= monthlyTarget && monthlyTarget > 0 ? "success" : "neutral"}
              hint={`of ${monthlyTarget} target`}
            />
            <StatTile label="Monthly Target" value={monthlyTarget} icon={<Target />} />
            <StatTile label="Completion Rate" value={`${completionRate}%`} icon={<TrendingUp />} />
          </div>

          {/* Progress Bar */}
          <Card padding="sm">
            <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
              <span className="eyebrow">Progress</span>
              <span className="tabular">{completed.length} / {monthlyTarget}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-ink-primary transition-all duration-500"
                style={{ width: `${Math.min(completionRate, 100)}%` }}
              />
            </div>
          </Card>

          {/* Type Breakdown */}
          {breakdownRows.length > 0 && (
            <section>
              <SectionHeader title="Media Breakdown" description={`${completed.length} wins by type`} />
              <Card padding="md">
                <ul className="space-y-3.5">
                  {breakdownRows.map(({ type, count }) => (
                    <li key={type}>
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="min-w-0 truncate text-sm text-ink-primary">
                          {DELIVERABLE_TYPE_LABELS[type as keyof typeof DELIVERABLE_TYPE_LABELS] || type}
                        </span>
                        <span className="shrink-0 text-sm font-medium text-ink-primary tabular">{count}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-ink-primary transition-all duration-500"
                          style={{ width: `${breakdownMax > 0 ? (count / breakdownMax) * 100 : 0}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {/* Wins */}
          {completed.length > 0 && (
            <section>
              <SectionHeader title="Completed Wins" />
              <div className="space-y-3">
                {completed.map((d) => (
                  <Card key={d.id} padding="sm">
                    <div className="mb-1.5">
                      <Badge tone="success" size="xs">
                        {DELIVERABLE_TYPE_LABELS[d.type as keyof typeof DELIVERABLE_TYPE_LABELS] || d.type}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-ink-primary">{d.title}</p>
                    {d.outcome && (
                      <p className="mt-1 max-w-prose text-sm text-ink-secondary">{d.outcome}</p>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* In Progress */}
          {inProgress.length > 0 && (
            <section>
              <SectionHeader title={`In Progress (${inProgress.length})`} />
              <Card padding="none" className="divide-y divide-border">
                {inProgress.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <Badge tone={statusTone(d.status)} size="xs" dot className="shrink-0">
                      {humanize(d.status)}
                    </Badge>
                    <span className="min-w-0 truncate text-sm text-ink-primary">{d.title}</span>
                  </div>
                ))}
              </Card>
            </section>
          )}

          {deliverables.length === 0 && (
            <EmptyState
              icon={<BarChart3 />}
              title="No deliverables this month"
              description={`Nothing was shared for ${monthLabel(month, year)}. Use the arrows to browse other months.`}
            />
          )}
        </>
      )}
    </div>
  );
}
