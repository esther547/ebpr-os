/**
 * Rewrite client agenda Google Docs so their MES blocks are the client's SERVICE PERIODS (Esther,
 * Oct 2 2026: "es para aplicar esa lógica a todo"). Each row keeps its real date, time, venue and
 * notes; only the block it sits in changes. Safety: a doc is skipped when it holds any dated row
 * the portal does not know (nothing may be lost), when the client has units pending review, or
 * when it is on the keep-as-is list. Google Docs version history keeps the previous version.
 *   npx tsx scripts/rewrite-agenda-docs-by-period.ts ["<client>"]            # plan
 *   npx tsx scripts/rewrite-agenda-docs-by-period.ts ["<client>"] --apply
 */
import { google, docs_v1 } from "googleapis";
import { readFileSync } from "fs";
import { db } from "../lib/db";
import { buildAgendaSections, writeAgendaDoc } from "../lib/google-docs-writer";
import { periodBoard } from "../lib/service-periods";
import { dayKeyInTz } from "../components/runners/miami-time";

// Esther: these docs are already right — never touch them. NA'VI's doc is manual-only (it was wiped twice by a regeneration).
const KEEP_AS_IS = ["Marko", "Pao Ruiz", "Camila Guiribitey", "NA'VI", "NAVI", "Dra. Paola"];

function loadKey() { const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="))!; let raw = line.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim(); if (/^['"]/.test(raw)) raw = raw.slice(1, -1); return JSON.parse(raw); }
const docs = google.docs({ version: "v1", auth: new google.auth.GoogleAuth({ credentials: loadKey(), scopes: ["https://www.googleapis.com/auth/documents.readonly"] }) });
const txt = (cell: docs_v1.Schema$TableCell | undefined) => (cell?.content ?? []).map((c) => (c.paragraph?.elements ?? []).map((e) => e.textRun?.content ?? "").join("")).join("\n").trim();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
// Same activity when the names share their start or their first real word ("LAFS Coctel…" = "LAFS x Nordstrom").
const sameName = (a: string, b: string) => {
  const x = norm(a), y = norm(b); if (!x || !y) return false;
  const p = Math.min(x.length, y.length, 14);
  if (x.slice(0, p) === y.slice(0, p)) return true;
  const fx = x.split(" ").find((w) => w.length >= 4), fy = y.split(" ").find((w) => w.length >= 4);
  if (!!fx && fx === fy) return true;
  // Same day and a shared distinctive word ("ANIMALS X NETFLIX" = "NETFLIX PREMIERE ANIMALS").
  const wx = new Set(x.split(" ").filter((w) => w.length >= 5));
  return y.split(" ").some((w) => w.length >= 5 && wx.has(w));
};
const dayKeyFromFecha = (text: string): string | null => { const m = text.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (!m) return null; const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return `${y}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`; };

async function docRows(docId: string): Promise<{ dayKey: string | null; name: string }[]> {
  const doc = await docs.documents.get({ documentId: docId });
  const out: { dayKey: string | null; name: string }[] = [];
  for (const el of doc.data.body?.content ?? []) for (const row of el.table?.tableRows ?? []) {
    const cells = row.tableCells ?? [];
    if (!/^\d+$/.test(txt(cells[0]))) continue;
    out.push({ dayKey: dayKeyFromFecha(txt(cells[1])), name: txt(cells[4]).split("\n")[0] });
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");
  const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const clients = await db.client.findMany({ where: { status: "ACTIVE", agendaDocUrl: { not: null }, ...(only ? { name: { contains: only, mode: "insensitive" } } : {}) }, select: { id: true, name: true, agendaDocUrl: true }, orderBy: { name: "asc" } });
  for (const c of clients) {
    if (KEEP_AS_IS.some((k) => c.name.startsWith(k))) { console.log(`— ${c.name}: se deja como está (doc correcto según Esther)`); continue; }
    const docId = c.agendaDocUrl!.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1];
    if (!docId) { console.log(`— ${c.name}: link inválido`); continue; }
    const board = await periodBoard(c.id);
    if (!board.periods.length) { console.log(`— ${c.name}: sin períodos en el portal, se omite`); continue; }
    // Periods labelled after the current month while holding past events mean the history fill is off for this client: needs Esther's values first.
    const now = new Date(); const nowIdx = now.getFullYear() * 12 + now.getMonth();
    const ahead = board.periods.filter((p) => p.refYear * 12 + (p.refMonth - 1) > nowIdx && p.units.some((u) => u.eventDate && u.eventDate < now));
    if (ahead.length && !force) { console.log(`— ${c.name}: sus períodos llegan a ${ahead.map((p) => p.label).join(", ")} con pautas ya pasadas; hay que revisar metas/valores antes de tocar el doc, se omite`); continue; }
    if (board.pending.some((u) => u.pautaId) && !force) { console.log(`— ${c.name}: tiene pautas pendientes de asignar a un período, se omite`); continue; }
    let rows: { dayKey: string | null; name: string }[];
    try { rows = await docRows(docId); } catch (e) { console.log(`— ${c.name}: no pude leer el doc (${(e as Error).message.slice(0, 60)})`); continue; }
    const pautas = await db.runnerAssignment.findMany({ where: { clientId: c.id }, select: { id: true, eventDate: true, eventName: true } });
    const goalsOnly = await db.deliverable.findMany({ where: { clientId: c.id, isInternal: false, periodId: { not: null } }, select: { title: true, dueDate: true, closedAt: true } });
    const known = (r: { dayKey: string | null; name: string }) =>
      pautas.some((p) => r.dayKey && dayKeyInTz(p.eventDate) === r.dayKey && sameName(p.eventName, r.name)) ||
      // a portal-era pauta whose date was moved after the doc row was written
      pautas.some((p) => !p.id.startsWith("agimp_") && sameName(p.eventName, r.name)) ||
      goalsOnly.some((g) => sameName(g.title, r.name));
    const unknown = rows.filter((r) => (r.dayKey || r.name.trim()) && !known(r)); // blank template rows are not content
    if (unknown.length) {
      console.log(`— ${c.name}: ${unknown.length} fila(s) del doc no están en el portal, se omite para no perderlas:`);
      unknown.slice(0, 5).forEach((u) => console.log(`     ${u.dayKey ?? "sin fecha"} ${u.name.slice(0, 50)}`));
      continue;
    }
    const sections = await buildAgendaSections(c.id);
    console.log(`${apply ? "REESCRIBIENDO" : "PLAN"} ${c.name}: ${rows.length} filas en el doc → ${sections.map((s) => `${s.heading.replace("MES ", "M")} ${s.rows.length}`).join(" · ")}`);
    if (!apply) continue;
    const res = await writeAgendaDoc(c.id, { force: true });
    console.log(res.ok ? `   ✓ listo` : `   ✗ ${res.error}`);
    await new Promise((r) => setTimeout(r, 4000)); // stay under the Docs write quota
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
