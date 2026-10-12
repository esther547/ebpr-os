/**
 * Several clients at the same event (Billboard, Premios, a party…) are still one pauta per client — each
 * client's agenda, goals and doc need their own row — but the runners' schedule shows the EVENT once with
 * the clients that go, one runner covers them all, and date/time/venue edits propagate (Esther, Oct 12 2026).
 * Rows linked by `eventGroupId`; rows nobody linked yet are grouped on the fly by day + venue/name.
 */
import { randomUUID } from "crypto";
const createId = () => randomUUID().replace(/-/g, "");
import { db } from "@/lib/db";
import { dayKeyInTz } from "@/components/runners/miami-time";

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["the", "de", "la", "el", "los", "las", "del", "y", "and", "x", "con", "en", "at", "of", "a", "evento", "event", "2026", "2027"]);
const words = (s: string | null | undefined) => norm(s).split(" ").filter((w) => w && !STOP.has(w));

/** Display key for a row: its explicit group (linked on creation or by the nightly pass), else the row itself. */
export function eventKeyOf(row: { id: string; eventGroupId?: string | null }): string {
  return row.eventGroupId ? `g:${row.eventGroupId}` : `p:${row.id}`;
}

/** Two rows on the same day that read as the same event (same venue, or names sharing most words). */
export function sameEvent(a: { eventDate: Date; venueName: string | null; eventName: string }, b: { eventDate: Date; venueName: string | null; eventName: string }): boolean {
  if (dayKeyInTz(a.eventDate) !== dayKeyInTz(b.eventDate)) return false;
  const va = words(a.venueName).slice(0, 3).join(" "), vb = words(b.venueName).slice(0, 3).join(" ");
  if (va && vb) { if (va === vb) return true; }
  const wa = new Set(words(a.eventName)), wb = new Set(words(b.eventName));
  if (!wa.size || !wb.size) return false;
  const common = [...wa].filter((w) => wb.has(w)).length;
  return common >= Math.max(2, Math.ceil(0.6 * Math.min(wa.size, wb.size)));
}

/** Link same-event pautas (from today on) that nobody grouped yet. Returns how many rows got a group. */
export async function linkEventGroups(days = 45): Promise<{ linked: number; groups: number }> {
  const from = new Date(Date.now() - 86400000), to = new Date(Date.now() + days * 86400000);
  const rows = await db.runnerAssignment.findMany({ where: { eventDate: { gte: from, lt: to }, status: { not: "CANCELLED" } }, select: { id: true, clientId: true, eventDate: true, venueName: true, eventName: true, eventGroupId: true }, orderBy: { eventDate: "asc" } });
  let linked = 0, groups = 0;
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) { const k = dayKeyInTz(r.eventDate); byDay.set(k, [...(byDay.get(k) ?? []), r]); }
  for (const list of byDay.values()) {
    const clusters: (typeof rows)[] = [];
    for (const r of list) {
      // Same event, and never the same client twice (a client with two pautas that day = two different things).
      const c = clusters.find((cl) => cl.some((x) => sameEvent(x, r)) && !cl.some((x) => x.clientId === r.clientId));
      if (c) c.push(r); else clusters.push([r]);
    }
    for (const c of clusters) {
      if (c.length < 2 || new Set(c.map((x) => x.clientId)).size < 2) continue; // one client twice is not an event group
      const gid = c.find((x) => x.eventGroupId)?.eventGroupId ?? createId();
      const todo = c.filter((x) => x.eventGroupId !== gid);
      if (!todo.length) continue;
      await db.runnerAssignment.updateMany({ where: { id: { in: todo.map((x) => x.id) } }, data: { eventGroupId: gid } });
      linked += todo.length; groups++;
    }
  }
  return { linked, groups };
}

/** The other pautas of the same event (explicit group only). */
export async function siblingsOf(pautaId: string): Promise<{ id: string; clientId: string | null; runnerId: string | null; status: string }[]> {
  const me = await db.runnerAssignment.findUnique({ where: { id: pautaId }, select: { eventGroupId: true } });
  if (!me?.eventGroupId) return [];
  return db.runnerAssignment.findMany({ where: { eventGroupId: me.eventGroupId, id: { not: pautaId }, status: { not: "CANCELLED" } }, select: { id: true, clientId: true, runnerId: true, status: true } });
}

/** Add `eventKey` and `coClients` (names of the other clients at the same event) to loaded rows. */
export function attachEventGroups<T extends { id: string; eventGroupId?: string | null; clientName?: string | null }>(rows: T[]): (T & { eventKey: string; coClients: string[] })[] {
  const keyed = rows.map((r) => ({ r, key: eventKeyOf(r) }));
  const names = new Map<string, Set<string>>();
  for (const { r, key } of keyed) { if (r.clientName) names.set(key, new Set([...(names.get(key) ?? []), r.clientName])); }
  return keyed.map(({ r, key }) => ({ ...r, eventKey: key, coClients: [...(names.get(key) ?? [])].filter((n) => n !== r.clientName) }));
}
