/**
 * Agenda months.
 *
 * Pautas are grouped by the Miami calendar month of their date (exactly how the
 * Google Docs were laid out before Sept 24), numbered MES 1, MES 2… in order. The agency keeps its own monthly accounting by hand
 * (some pautas count as two goals, months get rebalanced in the Google Doc), so the
 * portal never redistributes goals across months — Esther, Sept 25 2026.
 *
 * An item with an explicit `monthNumber` is pinned to that MES (manual override).
 */
import { dayKeyInTz } from "@/components/runners/miami-time";

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
  // Calendar month in Miami (the docs never used the cut-off cycle for their MES blocks).
  const cycleOf = (d: Date) => {
    const [y, m] = dayKeyInTz(d).split("-").map(Number);
    return { year: y, month: m };
  };

  // One section per calendar month that has items (no redistribution — see header note).
  const pinnedAway = sorted.some((it) => it.monthNumber && it.monthNumber >= 1);
  if (!pinnedAway) {
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
      .map((g, i) => section(i + 1, g.month, g.year, g.items, target));
  }

  // With pins: MES k = k-th calendar month from the first pauta; unpinned items go to their own month.
  const first = cycleOf(sorted[0].eventDate);
  const buckets = new Map<number, T[]>();
  const put = (k: number, it: T) => buckets.set(k, [...(buckets.get(k) ?? []), it]);
  const monthIndex = (d: Date) => {
    const c = cycleOf(d);
    return (c.year * 12 + c.month) - (first.year * 12 + first.month) + 1;
  };
  for (const it of sorted) put(it.monthNumber && it.monthNumber >= 1 ? it.monthNumber : monthIndex(it.eventDate), it);

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
