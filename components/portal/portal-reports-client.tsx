"use client";

import { useState, useEffect } from "react";
import { cn, DELIVERABLE_TYPE_LABELS, monthLabel } from "@/lib/utils";
import { Trophy, Target, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";

type Deliverable = {
  id: string;
  title: string;
  type: string;
  status: string;
  outcome: string | null;
  completedAt: string | Date | null;
};

interface Props {
  clientId: string;
  clientName: string;
  monthlyTarget: number;
  initialDeliverables: Deliverable[];
  initialMonth: number;
  initialYear: number;
}

export function PortalReportsClient({
  clientId,
  clientName,
  monthlyTarget,
  initialDeliverables,
  initialMonth,
  initialYear,
}: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [deliverables, setDeliverables] = useState(initialDeliverables);
  const [loading, setLoading] = useState(false);

  const isCurrentMonth = month === initialMonth && year === initialYear;

  useEffect(() => {
    if (isCurrentMonth) {
      setDeliverables(initialDeliverables);
      return;
    }

    setLoading(true);
    fetch(`/api/reports/${clientId}/monthly?month=${month}&year=${year}`)
      .then((res) => res.json())
      .then((data) => {
        setDeliverables(data.data?.deliverables ?? []);
      })
      .finally(() => setLoading(false));
  }, [month, year, clientId, isCurrentMonth, initialDeliverables]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === initialMonth && year === initialYear) return;
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

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

  return (
    <div>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">Monthly Report</h1>
          <p className="text-sm text-ink-muted">{clientName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="rounded-md p-1.5 hover:bg-surface-2 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-ink-secondary" />
          </button>
          <span className="text-sm font-medium text-ink-primary min-w-[140px] text-center">
            {monthLabel(month, year)}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              isCurrentMonth ? "opacity-30 cursor-not-allowed" : "hover:bg-surface-2"
            )}
          >
            <ChevronRight className="h-5 w-5 text-ink-secondary" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <p className="text-sm text-ink-muted">Loading...</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg border border-border bg-white p-5 text-center">
              <Trophy className="mx-auto h-5 w-5 text-green-600 mb-2" />
              <p className="text-2xl font-bold text-ink-primary">{completed.length}</p>
              <p className="text-xs text-ink-muted mt-1">Wins Delivered</p>
            </div>
            <div className="rounded-lg border border-border bg-white p-5 text-center">
              <Target className="mx-auto h-5 w-5 text-blue-600 mb-2" />
              <p className="text-2xl font-bold text-ink-primary">{monthlyTarget}</p>
              <p className="text-xs text-ink-muted mt-1">Monthly Target</p>
            </div>
            <div className="rounded-lg border border-border bg-white p-5 text-center">
              <TrendingUp className="mx-auto h-5 w-5 text-amber-600 mb-2" />
              <p className="text-2xl font-bold text-ink-primary">{completionRate}%</p>
              <p className="text-xs text-ink-muted mt-1">Completion Rate</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
              <span>Progress</span>
              <span>{completed.length} / {monthlyTarget}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-ink-primary transition-all duration-500"
                style={{ width: `${Math.min(completionRate, 100)}%` }}
              />
            </div>
          </div>

          {/* Type Breakdown */}
          {Object.keys(typeBreakdown).length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Media Breakdown
              </h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(typeBreakdown).map(([type, count]) => (
                  <span
                    key={type}
                    className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-secondary"
                  >
                    {DELIVERABLE_TYPE_LABELS[type as keyof typeof DELIVERABLE_TYPE_LABELS] || type}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Wins */}
          {completed.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Completed Wins
              </h2>
              <div className="space-y-3">
                {completed.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border bg-white p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-2xs font-medium text-green-700">
                        {DELIVERABLE_TYPE_LABELS[d.type as keyof typeof DELIVERABLE_TYPE_LABELS] || d.type}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-ink-primary">{d.title}</p>
                    {d.outcome && (
                      <p className="mt-1 text-sm text-ink-secondary">{d.outcome}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* In Progress */}
          {inProgress.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
                In Progress ({inProgress.length})
              </h2>
              <div className="space-y-2">
                {inProgress.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-medium text-blue-700">
                      {d.status.replace("_", " ")}
                    </span>
                    <span className="text-sm text-ink-primary">{d.title}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {deliverables.length === 0 && (
            <div className="text-center py-20">
              <p className="text-sm text-ink-muted">No deliverables this month.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
