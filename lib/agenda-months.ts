/**
 * Agenda "report months".
 *
 * The client agenda doubles as the monthly report: month N of service must show exactly
 * the client's monthly target (6 metas, 8 metas…), whatever calendar day each pauta
 * happened on. Goals are therefore poured, in chronological order, into consecutive
 * cycle months starting from the client's first pauta: MES 1 gets the first `target`
 * items, MES 2 the next `target`, and so on. A busy month spills forward, a slow month
 * is filled by the next one — which is how the agency reports goals owed.
 *
 * An item with an explicit `monthNumber` is pinned to that MES (manual override).
 * Clients without a target (PREP, 0) fall back to plain cycle-month grouping.
 */
import { cycleForDate, type Cycle } from "@/lib/cycles";

export const MONTH_NAMES_ES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
] as const;

export type AgendaMonthItem = {
  eventDate: Date;
  monthNumber?: number | null;
  agendaSequence?: number | null;
  createdAt?: Date;
};

export type AgendaMonth<T> = {
  /** MES 1, MES 2… (1-based, consecutive). */
  monthNumber: number;
  /** Calendar/cycle month this MES reports on. */
  month: number;
  year: number;
  /** "ENERO" */
  monthName: string;
  /** "MES 1 (ENERO)" — the Google Doc heading. */
  heading: string;
  /** Items in report order (chronological). */
  items: T[];
  /** The client's monthly target, 0 when none. */
  target: number;
};

function addMonths(year: number, month: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function chronological<T extends AgendaMonthItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const d = a.eventDate.getTime() - b.eventDate.getTime();
    if (d !== 0) return d;
    const sa = a.agendaSequence ?? Number.MAX_SAFE_INTEGER;
    const sb = b.agendaSequence ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
  });
}

export function allocateAgendaMonths<T extends AgendaMonthItem>(
  items: T[],
  client: { monthlyTarget: number | null | undefined; cycleDay: number | null | undefined }
): AgendaMonth<T>[] {
  const sorted = chronological(items);
  if (sorted.length === 0) return [];
  const target = Math.max(0, client.monthlyTarget ?? 0);
  const cycleOf = (d: Date): Cycle => cycleForDate(client.cycleDay, d);

  // No quota: one section per cycle month that has items.
  if (target === 0) {
    const groups = new Map<string, { month: number; year: number; items: T[] }>();
    for (const it of sorted) {
      const c = cycleOf(it.eventDate);
      const key = `${c.year}-${c.month}`;
      const g = groups.get(key) ?? { month: c.month, year: c.year, items: [] };
      g.items.push(it);
      groups.set(key, g);
    }
    return [...groups.values()]
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map((g, i) => section(i + 1, g.month, g.year, g.items, 0));
  }

  const first = cycleOf(sorted[0].eventDate);
  const buckets = new Map<number, T[]>();
  const put = (k: number, it: T) => buckets.set(k, [...(buckets.get(k) ?? []), it]);

  // Pinned items first: they reserve their slot in the MES the team chose.
  const pinned = sorted.filter((it) => it.monthNumber && it.monthNumber >= 1);
  for (const it of pinned) put(it.monthNumber as number, it);

  // Everything else pours forward: a MES is full when it holds `target` items.
  let k = 1;
  for (const it of sorted) {
    if (it.monthNumber && it.monthNumber >= 1) continue;
    while ((buckets.get(k)?.length ?? 0) >= target) k++;
    put(k, it);
  }

  const last = Math.max(...buckets.keys());
  const out: AgendaMonth<T>[] = [];
  for (let n = 1; n <= last; n++) {
    const bucket = buckets.get(n);
    if (!bucket) continue; // only possible through a pin far ahead; keep the numbering
    const { month, year } = addMonths(first.year, first.month, n - 1);
    out.push(section(n, month, year, chronological(bucket), target));
  }
  return out;
}

function section<T>(monthNumber: number, month: number, year: number, items: T[], target: number): AgendaMonth<T> {
  const monthName = MONTH_NAMES_ES[month - 1];
  return { monthNumber, month, year, monthName, heading: `MES ${monthNumber} (${monthName})`, items, target };
}
