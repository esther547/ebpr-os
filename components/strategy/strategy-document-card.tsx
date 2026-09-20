"use client";

import { formatDate } from "@/lib/utils";
import type { StrategyDocument } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { StrategyDocumentEditButton } from "./strategy-document-modal";

type Props = {
  doc: StrategyDocument;
  clientId: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <div className="text-sm leading-relaxed text-ink-secondary">{children}</div>
    </div>
  );
}

export function StrategyDocumentCard({ doc, clientId }: Props) {
  const keyMessages = doc.keyMessages as string[] | null;
  const externalCollabs = doc.externalCollaborators as
    | { name: string; role: string; organization?: string }[]
    | null;

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="eyebrow">Strategy Brief</h2>
          {doc.location && <span className="text-xs text-ink-muted">{doc.location}</span>}
          {doc.year && <span className="tabular text-xs text-ink-muted">{doc.year}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
          {doc.prepMonthStart && doc.prepMonthEnd && (
            <span>
              Prep:{" "}
              <span className="font-medium text-ink-secondary">
                {formatDate(doc.prepMonthStart)} – {formatDate(doc.prepMonthEnd)}
              </span>
            </span>
          )}
          {doc.campaignStart && (
            <span>
              Start:{" "}
              <span className="font-medium text-ink-secondary">{formatDate(doc.campaignStart)}</span>
            </span>
          )}
          <StrategyDocumentEditButton clientId={clientId} doc={doc} variant="ghost" size="xs">
            Edit
          </StrategyDocumentEditButton>
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        {(doc.objective || doc.strategicPath) && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {doc.objective && <Field label="Objetivo">{doc.objective}</Field>}
            {doc.strategicPath && <Field label="Camino Estratégico">{doc.strategicPath}</Field>}
          </div>
        )}

        {(doc.messagingFramework || doc.clientPersona) && (
          <div className="grid grid-cols-1 gap-6 border-t border-border pt-5 sm:grid-cols-2">
            {doc.messagingFramework && <Field label="Messaging">{doc.messagingFramework}</Field>}
            {doc.clientPersona && <Field label="Personaje">{doc.clientPersona}</Field>}
          </div>
        )}

        {(keyMessages?.length || doc.targetAudience) && (
          <div className="grid grid-cols-1 gap-6 border-t border-border pt-5 sm:grid-cols-2">
            {keyMessages && keyMessages.length > 0 && (
              <Field label="Key Messages">
                <ul className="space-y-1">
                  {keyMessages.map((msg, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-primary" />
                      <span className="font-medium italic text-ink-primary">&ldquo;{msg}&rdquo;</span>
                    </li>
                  ))}
                </ul>
              </Field>
            )}
            {doc.targetAudience && <Field label="Fanbase / Audience">{doc.targetAudience}</Field>}
          </div>
        )}

        {doc.executionNotes && (
          <div className="rounded-lg border border-border bg-surface-1 px-4 py-3">
            <p className="eyebrow mb-1.5">Execution Notes</p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-secondary">
              {doc.executionNotes}
            </p>
          </div>
        )}

        {externalCollabs && externalCollabs.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="eyebrow mb-2">External Team</p>
            <div className="flex flex-wrap gap-2">
              {externalCollabs.map((c, i) => (
                <span key={i} className="rounded-lg border border-border bg-surface-1 px-2.5 py-1 text-xs">
                  <span className="font-medium text-ink-primary">{c.name}</span>
                  <span className="text-ink-muted"> · {c.role}</span>
                  {c.organization && <span className="text-ink-muted"> ({c.organization})</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
