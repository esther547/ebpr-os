import { Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientWishlistButton } from "./client-wishlist-button";
import { StrategyItemContact } from "./contact-field";

type Item = {
  id: string;
  clientId: string;
  title: string;
  category: string;
  status: string;
  notes: string | null;
  requestedAt: Date | string | null;
  createdAt: Date | string;
  contactNotes: string | null;
  contactSource: string | null;
  contactUpdatedAt: Date | string | null;
};

const CATEGORY_ES: Record<string, string> = {
  MEDIA_TARGET: "Medio",
  INFLUENCER: "Creador",
  EVENT: "Evento",
  BRAND_OPPORTUNITY: "Marca",
  POSITIONING: "Posicionamiento",
  OTHER: "General",
};

function fmt(d: Date | string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Ideas the client called in with (StrategyItem.source = CLIENT). With
 * `showContacts`, each row carries its internal "Contacto / fuente".
 */
export function ClientWishlist({ clientId, items, showContacts = false }: { clientId: string; items: Item[]; showContacts?: boolean }) {
  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader
        className="mb-0 border-b border-border px-5 py-4"
        eyebrow="Lo que el cliente pide"
        title="Wish list cliente"
        description="Ideas y pedidos que el cliente nos hace llegar, con sus notas"
        actions={<ClientWishlistButton clientId={clientId} showContact={showContacts} />}
      />
      {items.length === 0 ? (
        <div className="p-4">
          <EmptyState compact icon={<Sparkles />} title="Sin pedidos del cliente todavía" description="Cuando el cliente llame con una idea, guárdala aquí con sus notas." />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-primary">{it.title}</p>
                {it.notes && <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-ink-secondary">{it.notes}</p>}
                {showContacts && <StrategyItemContact item={it} className="mt-2" />}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <Badge tone="info" size="xs">{CATEGORY_ES[it.category] ?? humanize(it.category)}</Badge>
                <Badge tone={statusTone(it.status)} size="xs">{humanize(it.status)}</Badge>
                <span className="text-2xs text-ink-muted">{fmt(it.requestedAt ?? it.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
