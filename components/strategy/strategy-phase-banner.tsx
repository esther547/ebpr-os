"use client";

import { formatDate } from "@/lib/utils";
import type { StrategyDocument } from "@prisma/client";
import { Card } from "@/components/ui/card";

export function StrategyPhaseBanner({ doc }: { doc: StrategyDocument }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {doc.phase1Name && (
        <Card>
          <p className="eyebrow mb-1">Phase 1</p>
          <p className="text-base font-semibold text-ink-primary">{doc.phase1Name}</p>
          {(doc.phase1Start || doc.phase1End) && (
            <p className="mt-1 text-xs text-ink-muted">
              {formatDate(doc.phase1Start)} – {formatDate(doc.phase1End)}
            </p>
          )}
        </Card>
      )}
      {doc.phase2Name && (
        <Card>
          <p className="eyebrow mb-1">Phase 2</p>
          <p className="text-base font-semibold text-ink-primary">{doc.phase2Name}</p>
          {(doc.phase2Start || doc.phase2End) && (
            <p className="mt-1 text-xs text-ink-muted">
              {formatDate(doc.phase2Start)} – {formatDate(doc.phase2End)}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
