"use client";

import { formatDate } from "@/lib/utils";
import type { StrategyDocument } from "@prisma/client";

export function StrategyPhaseBanner({ doc }: { doc: StrategyDocument }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {doc.phase1Name && (
        <div className="rounded-lg border border-border bg-white px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs font-bold uppercase tracking-widest text-ink-muted">
              Phase 1
            </span>
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          </div>
          <p className="font-bold text-ink-primary">{doc.phase1Name}</p>
          {(doc.phase1Start || doc.phase1End) && (
            <p className="mt-1 text-xs text-ink-muted">
              {formatDate(doc.phase1Start)} – {formatDate(doc.phase1End)}
            </p>
          )}
        </div>
      )}
      {doc.phase2Name && (
        <div className="rounded-lg border border-border bg-white px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs font-bold uppercase tracking-widest text-ink-muted">
              Phase 2
            </span>
            <div className="h-1.5 w-1.5 rounded-full bg-ink-primary" />
          </div>
          <p className="font-bold text-ink-primary">{doc.phase2Name}</p>
          {(doc.phase2Start || doc.phase2End) && (
            <p className="mt-1 text-xs text-ink-muted">
              {formatDate(doc.phase2Start)} – {formatDate(doc.phase2End)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
