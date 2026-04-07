"use client";

import { formatDate } from "@/lib/utils";
import type { StrategyDocument } from "@prisma/client";

type Props = {
  doc: StrategyDocument;
  clientId: string;
};

export function StrategyDocumentCard({ doc, clientId }: Props) {
  const keyMessages = doc.keyMessages as string[] | null;
  const servicesProvided = doc.servicesProvided as string[] | null;
  const externalCollabs = doc.externalCollaborators as
    | { name: string; role: string; organization?: string }[]
    | null;

  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-ink-primary text-sm uppercase tracking-wider">
            Strategy Brief
          </h2>
          {doc.location && (
            <span className="text-xs text-ink-muted">{doc.location}</span>
          )}
          {doc.year && (
            <span className="text-xs text-ink-muted">{doc.year}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-muted">
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
              <span className="font-medium text-ink-secondary">
                {formatDate(doc.campaignStart)}
              </span>
            </span>
          )}
          <button className="font-medium text-ink-primary hover:underline">
            Edit
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Objective + Strategic Path — 2 columns */}
        <div className="grid grid-cols-2 gap-6">
          {doc.objective && (
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-1.5">
                Objetivo
              </p>
              <p className="text-sm text-ink-secondary leading-relaxed">
                {doc.objective}
              </p>
            </div>
          )}
          {doc.strategicPath && (
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-1.5">
                Camino Estratégico
              </p>
              <p className="text-sm text-ink-secondary leading-relaxed">
                {doc.strategicPath}
              </p>
            </div>
          )}
        </div>

        {/* Messaging + Persona — 2 columns */}
        {(doc.messagingFramework || doc.clientPersona) && (
          <div className="grid grid-cols-2 gap-6 border-t border-border pt-5">
            {doc.messagingFramework && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-1.5">
                  Messaging
                </p>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  {doc.messagingFramework}
                </p>
              </div>
            )}
            {doc.clientPersona && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-1.5">
                  Personaje
                </p>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  {doc.clientPersona}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Key Messages + Audience — bottom row */}
        {(keyMessages?.length || doc.targetAudience) && (
          <div className="grid grid-cols-2 gap-6 border-t border-border pt-5">
            {keyMessages && keyMessages.length > 0 && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-2">
                  Key Messages
                </p>
                <ul className="space-y-1">
                  {keyMessages.map((msg, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-primary" />
                      <span className="font-medium text-ink-primary italic">
                        "{msg}"
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {doc.targetAudience && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-1.5">
                  Fanbase / Audience
                </p>
                <p className="text-sm text-ink-secondary">{doc.targetAudience}</p>
              </div>
            )}
          </div>
        )}

        {/* Execution notes */}
        {doc.executionNotes && (
          <div className="rounded-md bg-surface-2 border border-border px-4 py-3 border-t border-border mt-1">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-1.5">
              Execution Notes
            </p>
            <p className="text-xs text-ink-secondary leading-relaxed whitespace-pre-wrap">
              {doc.executionNotes}
            </p>
          </div>
        )}

        {/* External collaborators */}
        {externalCollabs && externalCollabs.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-muted mb-2">
              External Team
            </p>
            <div className="flex flex-wrap gap-2">
              {externalCollabs.map((c, i) => (
                <span
                  key={i}
                  className="rounded-md bg-surface-2 border border-border px-2.5 py-1 text-xs"
                >
                  <span className="font-medium text-ink-primary">{c.name}</span>
                  <span className="text-ink-muted"> · {c.role}</span>
                  {c.organization && (
                    <span className="text-ink-muted"> ({c.organization})</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
