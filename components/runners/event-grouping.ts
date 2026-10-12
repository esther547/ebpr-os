/** Client-side grouping of pautas that belong to the same event (see lib/event-groups.ts). */
export type Grouped<T> = { a: T; members: T[]; clients: string[] };

export function groupByEvent<T extends { id: string; eventKey?: string; clientName?: string | null }>(items: T[]): Grouped<T>[] {
  const order: string[] = [];
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = it.eventKey ?? it.id;
    if (!map.has(k)) { map.set(k, []); order.push(k); }
    map.get(k)!.push(it);
  }
  return order.map((k) => {
    const members = map.get(k)!;
    const clients = Array.from(new Set(members.map((m) => m.clientName).filter((n): n is string => !!n)));
    return { a: members[0], members, clients };
  });
}

/** "Casa D, Ana Vélez y 2 más" */
export function clientsLabel(clients: string[], max = 3): string {
  if (clients.length <= max) return clients.join(", ");
  return `${clients.slice(0, max).join(", ")} y ${clients.length - max} más`;
}
