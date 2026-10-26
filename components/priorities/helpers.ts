// Pure helpers shared by the server page and the client components.
// Everything here is string arithmetic on "yyyy-MM-dd" day keys, so server and
// browser always render the same label (no hydration mismatch).

export type PriorityItem = {
  id: string;
  clientId: string | null;
  /** Personal boards with categories (e.g. "EBPR"); null elsewhere. */
  category: string | null;
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

  const norm = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const handle = norm(match[2]);
  // "@paola" → first name; "@paolaf" / "@paolaprecilla" → first name + initial or the full name, so two Paolas can be told apart.
  const found = members.find((m) => {
    const parts = m.name.toLowerCase().split(/\s+/).filter(Boolean).map(norm);
    const full = parts.join("");
    const firstPlusInitial = parts.length > 1 ? parts[0] + parts[1][0] : parts[0];
    return parts[0] === handle || full === handle || firstPlusInitial === handle;
  });
  if (!found) return { title: text, assigneeId: null };

  const start = match.index + match[1].length;
  const title = (text.slice(0, start) + text.slice(match.index + match[0].length))
    .replace(/\s{2,}/g, " ")
    .trim();

  return { title: title || text, assigneeId: found.id };
}

/** Pending first, then the team's order; done items sink to the bottom. */
export function sortPriorities(items: PriorityItem[], byClient = false, clientOrder: string[] = []): PriorityItem[] {
  const rank = new Map(clientOrder.map((id, i) => [id, i]));
  const rankOf = (id: string | null) => (id && rank.has(id) ? (rank.get(id) as number) : Number.MAX_SAFE_INTEGER);
  return [...items].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    if (byClient) {
      // Esther's manual order (most urgent first); the rest A–Z after it.
      const r = rankOf(a.clientId) - rankOf(b.clientId);
      if (r !== 0) return r;
      const c = (a.client?.name ?? "").localeCompare(b.client?.name ?? "");
      if (c !== 0) return c;
    }
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
