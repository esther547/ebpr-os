/**
 * Append-only Google Doc sync (Esther, Sept 25 2026).
 *
 * The agenda Google Docs are the agency's own monthly ledger: months are balanced by hand and
 * some pautas count as two goals. The portal therefore NEVER rewrites a doc. It only adds the
 * pautas the doc does not have yet, each one as a new row at the bottom of the "MES N (MONTH)"
 * block of its calendar month (Miami), or in a new block at the end when that month has none.
 * Nothing existing is moved, renumbered, restyled or deleted.
 *
 * Cost per doc: 1 read (+ 2 writes + 1 read only when there is something to add).
 */
import type { docs_v1 } from "googleapis";
import { db } from "@/lib/db";
import { dayKeyInTz } from "@/components/runners/miami-time";
import { extractDocId } from "@/lib/google-docs";
import {
  AGENDA_TABLE_HEADER,
  MONTH_NAMES_ES,
  formatFecha,
  formatHora,
  getDocsClient,
  type AgendaDocErrorKind,
} from "@/lib/agenda-doc-shared";
import {
  HEADER_ROW_BG,
  MONTH_ROW_BG,
  MONTH_ROW_MIN_HEIGHT_PT,
  baseTextRequests,
  cellBlockStyle,
  dataRowCellRequests,
  fillCellRequests,
  mergeRowRequest,
  rowHeightStyle,
  type CellFill,
} from "@/lib/agenda-doc-style";

export type AppendResult =
  | { ok: true; added: number; skipped: number; docRows: number; planned?: string[] }
  | { ok: false; kind: AgendaDocErrorKind; error: string };

const COLUMNS = AGENDA_TABLE_HEADER.length;
const MAX_ROWS_PER_RUN = 40;

type Pauta = {
  id: string;
  eventDate: Date;
  eventTime: Date | null;
  eventName: string;
  venueName: string | null;
  venueAddress: string | null;
  notes: string | null;
  status: string;
  runnerId: string | null;
  createdAt: Date;
};

/** A "MES N (…)" block inside the doc's single agenda table. */
type Block = {
  number: number;
  monthName: string | null;
  /** Row index of the MES row inside the table. */
  headingRow: number;
  /** Last row of the block (heading, header or a data row). */
  lastRow: number;
  /** Highest "#" seen in the block (0 when none). */
  lastNumber: number;
};

const cellText = (cell: docs_v1.Schema$TableCell | undefined) =>
  (cell?.content ?? [])
    .map((c) => (c.paragraph?.elements ?? []).map((e) => e.textRun?.content ?? "").join(""))
    .join("")
    .replace(/\u000b/g, "\n")
    .trim();

/** Uppercase, no accents, single spaces — for fuzzy "is this pauta already in the doc?" checks. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameName(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const n = Math.min(x.length, y.length, 14);
  return n >= 6 && x.slice(0, n) === y.slice(0, n);
}

/** "Viernes\n01/23/26" → "2026-01-23"; null when the cell holds no date. */
function dayKeyFromFecha(text: string): string | null {
  const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function estadoFor(a: Pauta, now: Date): string {
  if (a.status === "CANCELLED") return "Passed by client";
  if (!a.runnerId && a.eventDate.getTime() > now.getTime()) return "Pending";
  return "Goal";
}

function joinLines(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join("\n");
}

type DocIndex = {
  table: docs_v1.Schema$StructuralElement | null;
  blocks: Block[];
  /** Existing pautas: (dayKey, first line of ITEM). */
  rows: { dayKey: string; name: string }[];
};

/** Reads the doc's agenda table: its MES blocks and the pautas it already lists. */
function indexDoc(body: docs_v1.Schema$Body | undefined): DocIndex {
  const out: DocIndex = { table: null, blocks: [], rows: [] };
  for (const el of body?.content ?? []) {
    const rows = el.table?.tableRows ?? [];
    if (!rows.length) continue;
    let current: Block | null = null;
    let hasMes = false;
    rows.forEach((row, i) => {
      const cells = row.tableCells ?? [];
      const first = cellText(cells[0]);
      const mes = first.match(/^MES\s*(\d+)\s*(?:\(([^)]+)\))?/i);
      if (mes) {
        hasMes = true;
        current = { number: Number(mes[1]), monthName: mes[2] ? norm(mes[2]) : null, headingRow: i, lastRow: i, lastNumber: 0 };
        out.blocks.push(current);
        return;
      }
      if (current) current.lastRow = i;
      const dayKey = dayKeyFromFecha(cellText(cells[1]));
      if (dayKey) {
        const n = parseInt(first, 10);
        if (current && Number.isFinite(n)) current.lastNumber = Math.max(current.lastNumber, n);
        out.rows.push({ dayKey, name: cellText(cells[4]).split("\n")[0] });
      }
    });
    // The agenda table is the first table holding MES blocks (the template has only one).
    if (hasMes && !out.table) out.table = el;
  }
  return out;
}

/**
 * Adds to the client's Google Doc every portal pauta the doc does not list yet.
 * `dryRun` only reports what would be appended.
 */
export async function appendNewPautasToDoc(clientId: string, opts: { dryRun?: boolean } = {}): Promise<AppendResult> {
  const now = new Date();
  const client = await db.client.findUnique({ where: { id: clientId }, select: { agendaDocUrl: true } });
  if (!client) return { ok: false, kind: "not_found", error: "Cliente no encontrado." };
  if (!client.agendaDocUrl) return { ok: false, kind: "bad_url", error: "Este cliente no tiene un Google Doc de agenda configurado." };
  const documentId = extractDocId(client.agendaDocUrl);
  if (!documentId) return { ok: false, kind: "bad_url", error: "El link del Google Doc no es válido." };

  const pautas: Pauta[] = await db.runnerAssignment.findMany({
    where: { clientId },
    orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, eventDate: true, eventTime: true, eventName: true, venueName: true, venueAddress: true,
      notes: true, status: true, runnerId: true, createdAt: true,
    },
  });

  let docs: docs_v1.Docs;
  try {
    docs = getDocsClient();
  } catch (err) {
    return { ok: false, kind: "not_configured", error: (err as Error).message };
  }

  try {
    const doc = await docs.documents.get({ documentId });
    const index = indexDoc(doc.data.body);
    if (!index.table || index.blocks.length === 0) {
      return { ok: false, kind: "other", error: "El documento no tiene bloques \"MES N\"; no se agregó nada." };
    }

    // What is missing: same day + same (or same-prefix) name means "already there".
    const missing = pautas.filter((p) => {
      const dayKey = dayKeyInTz(p.eventDate);
      return !index.rows.some((r) => r.dayKey === dayKey && sameName(r.name, p.eventName));
    });
    const skipped = Math.max(0, missing.length - MAX_ROWS_PER_RUN);
    const toAdd = missing.slice(0, MAX_ROWS_PER_RUN);
    if (toAdd.length === 0) return { ok: true, added: 0, skipped: 0, docRows: index.rows.length };

    // Plan: which block gets each pauta (last block of that month; else a new block at the end).
    const tableStart = index.table.startIndex!;
    const tableRows = index.table.table!.tableRows!.length;
    const blocks = [...index.blocks].sort((a, b) => a.headingRow - b.headingRow);
    type NewBlock = { monthName: string; number: number; pautas: Pauta[] };
    const perBlock = new Map<Block, Pauta[]>();
    const newBlocks: NewBlock[] = [];
    let nextNumber = Math.max(...blocks.map((b) => b.number)) + 1;
    for (const p of toAdd) {
      const [, m] = dayKeyInTz(p.eventDate).split("-").map(Number);
      const monthName = MONTH_NAMES_ES[m - 1];
      const target = [...blocks].reverse().find((b) => b.monthName === norm(monthName));
      if (target) {
        perBlock.set(target, [...(perBlock.get(target) ?? []), p]);
        continue;
      }
      const nb = newBlocks.find((b) => b.monthName === monthName);
      if (nb) nb.pautas.push(p);
      else newBlocks.push({ monthName, number: nextNumber++, pautas: [p] });
    }

    const planned = [
      ...[...perBlock.entries()].flatMap(([b, ps]) => ps.map((p) => `MES ${b.number}: ${dayKeyInTz(p.eventDate)} ${p.eventName}`)),
      ...newBlocks.flatMap((b) => b.pautas.map((p) => `MES ${b.number} (${b.monthName}, nuevo): ${dayKeyInTz(p.eventDate)} ${p.eventName}`)),
    ];
    if (opts.dryRun) return { ok: true, added: 0, skipped, docRows: index.rows.length, planned };

    // ── Write 1: insert empty rows. Bottom-up so earlier row indexes stay valid within the batch. ──
    type Group = { afterRow: number; count: number; kind: "data" | "block"; block?: Block; nb?: NewBlock };
    const groups: Group[] = [];
    for (const [b, ps] of perBlock) groups.push({ afterRow: b.lastRow, count: ps.length, kind: "data", block: b });
    // New blocks go at the very end: MES row + header row + data rows each.
    let endRow = tableRows - 1;
    for (const nb of newBlocks) {
      groups.push({ afterRow: endRow, count: 2 + nb.pautas.length, kind: "block", nb });
      endRow += 2 + nb.pautas.length; // only matters for ordering; inserted sequentially below
    }
    groups.sort((a, b) => b.afterRow - a.afterRow);
    const insertRequests: docs_v1.Schema$Request[] = [];
    for (const g of groups) {
      for (let i = 0; i < g.count; i++) {
        insertRequests.push({
          insertTableRow: {
            tableCellLocation: { tableStartLocation: { index: tableStart }, rowIndex: g.afterRow + i, columnIndex: 0 },
            insertBelow: true,
          },
        });
      }
    }
    await docs.documents.batchUpdate({ documentId, requestBody: { requests: insertRequests } });

    // ── Read: the new rows' cell indexes. Final row positions = original + rows inserted above. ──
    const after = await docs.documents.get({ documentId });
    const table = (after.data.body?.content ?? []).find((el) => el.table && el.startIndex === tableStart)
      ?? (after.data.body?.content ?? []).filter((el) => el.table).find((el) => (el.startIndex ?? 0) >= tableStart);
    const rows = table?.table?.tableRows ?? [];
    if (!table || !rows.length) return { ok: false, kind: "other", error: "No pude releer la tabla de la agenda después de insertar filas." };
    const tStart = table.startIndex!;

    const ascending = [...groups].sort((a, b) => a.afterRow - b.afterRow);
    let offset = 0;
    const placed: { g: Group; firstRow: number }[] = [];
    for (const g of ascending) {
      placed.push({ g, firstRow: g.afterRow + 1 + offset });
      offset += g.count;
    }

    // ── Write 2: texts + styles, lower rows first so text inserts never shift what is still pending. ──
    const requests: docs_v1.Schema$Request[] = [];
    const mergeRows: number[] = [];
    for (const { g, firstRow } of [...placed].reverse()) {
      const fills: CellFill[] = [];
      const cellIdx = (r: number, c: number) => rows[r]?.tableCells?.[c]?.content?.[0]?.startIndex ?? 0;
      let r = firstRow;
      if (g.kind === "block") {
        const nb = g.nb!;
        AGENDA_TABLE_HEADER.forEach((_, c) => fills.push({ index: cellIdx(r, c), text: c === 0 ? `MES ${nb.number} (${nb.monthName})` : "", bold: "all", white: true, align: "CENTER" }));
        requests.push(cellBlockStyle(tStart, r, 1, 0, COLUMNS, MONTH_ROW_BG), rowHeightStyle(tStart, [r], MONTH_ROW_MIN_HEIGHT_PT));
        mergeRows.push(r);
        r++;
        AGENDA_TABLE_HEADER.forEach((text, c) => fills.push({ index: cellIdx(r, c), text, bold: "all", white: true, align: c === 0 ? "START" : "CENTER" }));
        requests.push(cellBlockStyle(tStart, r, 1, 0, COLUMNS, HEADER_ROW_BG));
        r++;
        nb.pautas.forEach((p, i) => {
          fills.push(...dataFills(p, i + 1, r, cellIdx, now));
          requests.push(...dataRowCellRequests(tStart, r, COLUMNS));
          r++;
        });
      } else {
        const ps = perBlock.get(g.block!)!;
        ps.forEach((p, i) => {
          fills.push(...dataFills(p, g.block!.lastNumber + i + 1, r, cellIdx, now));
          requests.push(...dataRowCellRequests(tStart, r, COLUMNS));
          r++;
        });
      }
      const { inserts, styles, inserted } = fillCellRequests(fills);
      const first = Math.min(...fills.map((f) => f.index));
      const last = Math.max(...fills.map((f) => f.index));
      requests.push(...inserts, ...baseTextRequests(first, last + inserted + 1), ...styles);
    }
    for (const r of mergeRows) requests.push(mergeRowRequest(tStart, r, COLUMNS));
    await docs.documents.batchUpdate({ documentId, requestBody: { requests } });

    await db.client.update({ where: { id: clientId }, data: { agendaDocSyncedAt: new Date() } }).catch(() => undefined);
    return { ok: true, added: toAdd.length, skipped, docRows: index.rows.length, planned };
  } catch (err) {
    const e = err as { code?: number | string; message?: string; response?: { status?: number } };
    const status = Number(e?.response?.status ?? e?.code);
    if (status === 403) return { ok: false, kind: "not_shared", error: "El documento no está compartido como Editor con la cuenta de servicio." };
    if (status === 404) return { ok: false, kind: "not_found", error: "El documento no existe o el link es incorrecto (404)." };
    return { ok: false, kind: "other", error: e?.message ?? String(err) };
  }
}

function dataFills(p: Pauta, number: number, row: number, cellIdx: (r: number, c: number) => number, now: Date): CellFill[] {
  const hora = formatHora(p.eventTime);
  const values = [String(number), formatFecha(dayKeyInTz(p.eventDate)), hora, joinLines(p.venueName, p.venueAddress), joinLines(p.eventName, p.notes), estadoFor(p, now)];
  return values.map((text, c) => ({
    index: cellIdx(row, c),
    text,
    bold: c === 0 ? "all" : c === 2 ? (hora !== "—" ? "all" : "none") : c === 4 ? "firstLine" : "none",
    align: c === 0 ? "START" : "CENTER",
  }));
}
