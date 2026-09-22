// Pure helpers shared by the server page and the client components.
// Everything here is string arithmetic on "yyyy-MM-dd" day keys, so server and
// browser always render the same label (no hydration mismatch).

export type PriorityItem = {
  id: string;
  clientId: string | null;
  title: string;
  notes: string | null;
  assigneeId: string | null;
  isDone: boolean;
  order: number;
  client: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
};

export type TeamMember = { id: string; name: string };
export type ClientOption = { id: string; name: string };

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Add days to a "yyyy-MM-dd" key (plain calendar arithmetic, UTC-safe). */
export function shiftDayKey(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Semana del 21 al 27 de septiembre" (spells out both months when it spans two). */
export function weekRangeLabel(weekKey: string): string {
  const endKey = shiftDayKey(weekKey, 6);
  const [sy, sm, sd] = weekKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  const startMonth = MONTHS_ES[sm - 1];
  const endMonth = MONTHS_ES[em - 1];
  if (sy === ey && sm === em) return `Semana del ${sd} al ${ed} de ${startMonth}`;
  if (sy === ey) return `Semana del ${sd} de ${startMonth} al ${ed} de ${endMonth}`;
  return `Semana del ${sd} de ${startMonth} de ${sy} al ${ed} de ${endMonth} de ${ey}`;
}

/** Up to two initials for the assignee badge. */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const MENTION_RE = /(^|\s)@([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9'._-]*)/;

/**
 * Quick-add parsing: "Cerrar YRYS podcast @paola" -> title + assignee.
 * An unknown handle is left in the text so nothing is silently dropped.
 */
export function parseQuickAdd(
  raw: string,
  members: TeamMember[]
): { title: string; assigneeId: string | null } {
  const text = raw.trim();
  const match = MENTION_RE.exec(text);
  if (!match) return { title: text, assigneeId: null };

  const handle = match[2].toLowerCase();
  const found = members.find((m) => {
    const name = m.name.toLowerCase();
    return name.split(/\s+/)[0] === handle || name.replace(/\s+/g, "") === handle;
  });
  if (!found) return { title: text, assigneeId: null };

  const start = match.index + match[1].length;
  const title = (text.slice(0, start) + text.slice(match.index + match[0].length))
    .replace(/\s{2,}/g, " ")
    .trim();

  return { title: title || text, assigneeId: found.id };
}

/** Pending first, then the team's order; done items sink to the bottom. */
export function sortPriorities(items: PriorityItem[]): PriorityItem[] {
  return [...items].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
}

/** "3 pendientes · 1 hecha" style counter for a card header. */
export function countLabel(items: PriorityItem[]): string {
  const done = items.filter((i) => i.isDone).length;
  const pending = items.length - done;
  const parts = [`${pending} ${pending === 1 ? "pendiente" : "pendientes"}`];
  if (done > 0) parts.push(`${done} ${done === 1 ? "hecha" : "hechas"}`);
  return parts.join(" · ");
}
