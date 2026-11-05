/** Client-side grouping of pautas that belong to the same event (see lib/event-groups.ts). */
export type Grouped<T> = { a: T; members: T[]; clients: string[] };

/**
 * Esther, Nov 4 2026: never merge pautas in the views. Each pauta is its own card — its talent, its runner and the
 * hour of its own agenda — even when several talents go to the same event with the same runner.
 * (eventGroupId / eventKey stay on the data for the "same runner for all" assignment shortcut.)
 */
export function groupByEvent<T extends { id: string; eventKey?: string; clientName?: string | null }>(items: T[]): Grouped<T>[] {
  return items.map((it) => ({ a: it, members: [it], clients: it.clientName ? [it.clientName] : [] }));
}

/** "Casa D, Ana Vélez y 2 más" */
export function clientsLabel(clients: string[], max = 3): string {
  if (clients.length <= max) return clients.join(", ");
  return `${clients.slice(0, max).join(", ")} y ${clients.length - max} más`;
}
