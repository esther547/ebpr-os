/**
 * Read a client's Agenda Google Doc through the service account (Docs API) and
 * emit rows in the same JSON shape scripts/import-agenda.ts consumes.
 *   npx tsx scripts/fetch-agenda-doc.ts "<Client name>" <docId> > rows.json
 */
import { google } from "googleapis";
import { createHash } from "crypto";

const [, , clientName, docId] = process.argv;
if (!clientName || !docId) { console.error("usage: fetch-agenda-doc.ts <client> <docId>"); process.exit(1); }

import { readFileSync } from "fs";
function loadKey(): Record<string, string> {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? "";
  if (!raw.trim().startsWith("{")) {
    // Read straight from .env (the value is a quoted JSON blob shells mangle).
    const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="));
    raw = (line ?? "").slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).trim();
    if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) raw = raw.slice(1, -1);
  }
  try { return JSON.parse(raw); } catch { console.error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON"); process.exit(1); }
}
const creds = loadKey();
const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/documents.readonly"] });
const docs = google.docs({ version: "v1", auth });

function cellText(cell: any): string {
  const lines: string[] = [];
  for (const c of cell.content ?? []) {
    let t = "";
    for (const e of c.paragraph?.elements ?? []) t += e.textRun?.content ?? "";
    lines.push(t.replace(/\n$/, ""));
  }
  return lines.join("\n").replace(/[ \t ]+/g, " ").trim();
}

async function main() {
  const res = await docs.documents.get({ documentId: docId });
  const out: any[] = [];
  for (const el of res.data.body?.content ?? []) {
    for (const row of el.table?.tableRows ?? []) {
      const cells = (row.tableCells ?? []).map(cellText);
      if (cells.length < 6) continue;
      const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(cells[1]);
      if (!m) continue;
      const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      const date = `${y}-${String(+m[1]).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`;
      const hora = cells[2].trim();
      const hm = /(\d{1,2})(?::(\d{2}))?\s*([AP])\.?\s*M/i.exec(hora);
      let time: string | null = null;
      if (hm) { const h = (+hm[1] % 12) + (hm[3].toUpperCase() === "P" ? 12 : 0); time = `${String(h).padStart(2, "0")}:${String(+(hm[2] ?? 0)).padStart(2, "0")}`; }
      const lines = cells[4].split("\n").map((s) => s.trim()).filter(Boolean);
      const title = lines[0] ?? ""; if (!title) continue;
      const estado = cells[5].trim().toLowerCase();
      const notes = [lines.slice(1).join("\n"), estado && estado !== "goal" ? cells[5].trim() : ""].filter(Boolean).join("\n").slice(0, 1500);
      const id = "agimp_" + createHash("sha1").update(`${clientName}|${date}|${title.toLowerCase()}|${hora}`).digest("hex").slice(0, 16);
      out.push({ id, client: clientName, date, time, timeRaw: hora, venue: cells[3].trim(), title: title.slice(0, 180), notes, estado, doc: docId });
    }
  }
  process.stdout.write(JSON.stringify(out));
  console.error(`${clientName}: ${out.length} rows`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
