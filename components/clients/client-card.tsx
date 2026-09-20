import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";

export type ClientCardData = {
  id: string;
  name: string;
  status: string;
  industry: string | null;
  onboardingStatus: string | null;
  counts: { deliverables: number; campaigns: number; contracts: number };
};

/** Two-letter monogram from the client name. */
export function initials(name: string): string {
  // Strip punctuation so names like "Ana Cisneros (SIMG)" don't yield "A(".
  const parts = name
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ClientCard({ client }: { client: ClientCardData }) {
  return (
    <Link href={`/clients/${client.id}`} className="group block rounded-xl">
      <Card interactive className="h-full">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-secondary ring-1 ring-inset ring-border">
            {initials(client.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-ink-primary">{client.name}</h3>
            <p className="mt-0.5 truncate text-xs text-ink-muted">{client.industry || "No industry set"}</p>
          </div>
          <Badge tone={statusTone(client.status)} dot>
            {humanize(client.status)}
          </Badge>
        </div>

        {client.onboardingStatus && client.status === "PROSPECT" && (
          <p className="mb-3 text-xs text-ink-muted">
            Onboarding: <span className="font-medium text-ink-secondary">{humanize(client.onboardingStatus)}</span>
          </p>
        )}

        <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-ink-muted">
          <span>
            <span className="tabular font-semibold text-ink-primary">{client.counts.deliverables}</span> deliverables
          </span>
          <span>
            <span className="tabular font-semibold text-ink-primary">{client.counts.campaigns}</span> campaigns
          </span>
          <span>
            <span className="tabular font-semibold text-ink-primary">{client.counts.contracts}</span> contracts
          </span>
        </div>
      </Card>
    </Link>
  );
}
