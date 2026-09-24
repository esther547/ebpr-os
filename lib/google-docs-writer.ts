/**
 * Portal → Google Doc agenda mirroring.
 *
 * The portal is the source of truth for a client's agenda. Each client's
 * "Agenda 2026" Google Doc (Client.agendaDocUrl) is *regenerated* from the
 * RunnerAssignment rows: nightly from the daily cron, and on demand from the
 * "Actualizar Google Doc" button on the client agenda page.
 *
 * Only the part of the document from the first "MES ..." paragraph down is
 * replaced — the header block (title, client name, "Presented by:", the EB
 * logo, the company lines) is never touched.
 *
 * The docs are owned by the agency; the service account
 * (ebpr-docs@ebpr-492704.iam.gserviceaccount.com) must be added as an **Editor**
 * on each one. Until that happens every write fails with a clean 403 result —
 * it never throws and never crashes the cron.
 */
import { google } from "googleapis";
import type { docs_v1 } from "googleapis";
import { db } from "@/lib/db";
import { GOOGLE_NOT_CONFIGURED, extractDocId, getGoogleCredentials } from "@/lib/google-docs";
import { dayKeyInTz, dayOfWeekForKey, minutesOfDayInTz } from "@/components/runners/miami-time";

export const SERVICE_ACCOUNT_EMAIL_FALLBACK = "ebpr-docs@ebpr-492704.iam.gserviceaccount.com";

/** Read-write Docs client. Throws GOOGLE_NOT_CONFIGURED when the key is absent. */
export function getDocsClient(): docs_v1.Docs {
  const credentials = getGoogleCredentials();
  if (!credentials) throw new Error(GOOGLE_NOT_CONFIGURED);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/documents"],
  });
  return google.docs({ version: "v1", auth });
}

function serviceAccountEmail(): string {
  return getGoogleCredentials()?.client_email ?? SERVICE_ACCOUNT_EMAIL_FALLBACK;
}

// ─── Data model ──────────────────────────────────────────

export const MONTH_NAMES_ES = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
] as const;

const WEEKDAY_NAMES_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const AGENDA_TABLE_HEADER = ["#", "FECHA", "HORA", "LUGAR", "ITEM", "ESTADO"] as const;

export type AgendaRow = {
  /** 1-based position inside its month section. */
  number: number;
  /** "Viernes\n01/23/26" */
  fecha: string;
  /** "8 PM" / "8:30 PM" / "—" */
  hora: string;
  lugar: string;
  item: string;
  estado: "Goal" | "Pending" | "Passed by client";
};

export type AgendaSection = {
  /** 1-based across the sections present, not the calendar month. */
  monthNumber: number;
  /** "ENERO" … "DICIEMBRE" */
  monthName: string;
  /** "MES 1 (ENERO)" */
  heading: string;
  rows: AgendaRow[];
};

/** "8 PM" / "8:30 PM" in Miami time; "—" when the row carries no time. */
export function formatHora(eventTime: Date | null | undefined): string {
  if (!eventTime) return "—";
  const minutes = minutesOfDayInTz(eventTime);
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "Viernes\n01/23/26" for a Miami "yyyy-MM-dd" day key. */
export function formatFecha(dayKey: string): string {
  const weekday = WEEKDAY_NAMES_ES[dayOfWeekForKey(dayKey)];
  const [y, mo, d] = dayKey.split("-");
  return `${weekday}\n${mo}/${d}/${y.slice(2)}`;
}

type AssignmentLike = {
  eventDate: Date;
  eventTime: Date | null;
  eventName: string;
  venueName: string | null;
  venueAddress: string | null;
  notes: string | null;
  status: string;
  runnerId: string | null;
};

function estadoFor(a: AssignmentLike, now: Date): AgendaRow["estado"] {
  if (a.status === "CANCELLED") return "Passed by client";
  if (!a.runnerId && a.eventDate.getTime() > now.getTime()) return "Pending";
  return "Goal";
}

function joinLines(...parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

/** Pure transform: assignments → month sections. Exported for testing. */
export function sectionsFromAssignments(
  assignments: AssignmentLike[],
  now = new Date()
): AgendaSection[] {
  const sorted = [...assignments].sort(
    (a, b) => a.eventDate.getTime() - b.eventDate.getTime()
  );

  // Group by Miami calendar month, preserving chronological order.
  const byMonth = new Map<string, AgendaRow[]>();
  for (const a of sorted) {
    const dayKey = dayKeyInTz(a.eventDate);
    const monthKey = dayKey.slice(0, 7); // "2026-01"
    const rows = byMonth.get(monthKey) ?? [];
    rows.push({
      number: rows.length + 1,
      fecha: formatFecha(dayKey),
      hora: formatHora(a.eventTime),
      lugar: joinLines(a.venueName, a.venueAddress),
      item: joinLines(a.eventName, a.notes),
      estado: estadoFor(a, now),
    });
    byMonth.set(monthKey, rows);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, rows], i) => {
      const monthName = MONTH_NAMES_ES[Number(monthKey.slice(5, 7)) - 1];
      return {
        monthNumber: i + 1,
        monthName,
        heading: `MES ${i + 1} (${monthName})`,
        rows,
      };
    });
}

/** Loads a client's agenda rows and turns them into the doc's month sections. */
export async function buildAgendaSections(clientId: string): Promise<AgendaSection[]> {
  const assignments = await db.runnerAssignment.findMany({
    where: { clientId },
    orderBy: [{ eventDate: "asc" }],
    select: {
      eventDate: true,
      eventTime: true,
      eventName: true,
      venueName: true,
      venueAddress: true,
      notes: true,
      status: true,
      runnerId: true,
    },
  });
  return sectionsFromAssignments(assignments);
}

// ─── Doc inspection helpers ──────────────────────────────

function paragraphText(el: docs_v1.Schema$StructuralElement): string {
  let text = "";
  for (const e of el.paragraph?.elements ?? []) {
    if (e.textRun?.content) text += e.textRun.content;
  }
  return text;
}

/**
 * Leading text of a structural element: the paragraph's own text, or — for a
 * table — the text of its very first cell. The agenda docs that exist today put
 * the "MES N (…)" heading in a full-width first row *inside* the month table,
 * so the anchor has to look at tables too or a regeneration would append a
 * second copy of the agenda instead of replacing the first.
 */
function leadingText(el: docs_v1.Schema$StructuralElement): string {
  if (el.paragraph) return paragraphText(el);
  const firstCell = el.table?.tableRows?.[0]?.tableCells?.[0];
  if (!firstCell) return "";
  return (firstCell.content ?? []).map(paragraphText).join("");
}

/**
 * Start index of the first block (paragraph or table) whose text begins with
 * "MES " (case insensitive, trimmed), or null when the doc has no month
 * sections yet. Everything above it is the header block and is preserved.
 */
export function findFirstMesIndex(body: docs_v1.Schema$Body | undefined): number | null {
  for (const el of body?.content ?? []) {
    if (!el.paragraph && !el.table) continue;
    if (/^mes\s/i.test(leadingText(el).trim())) {
      return el.startIndex ?? null;
    }
  }
  return null;
}

/** Index just past the last character of the body (its final, undeletable newline). */
function bodyEndIndex(body: docs_v1.Schema$Body | undefined): number {
  const content = body?.content ?? [];
  return content.length ? content[content.length - 1].endIndex ?? 1 : 1;
}

/** Table rows whose second cell looks like a date (MM/DD/YY) — i.e. real pautas in the Doc. */
function countDatedRows(body: docs_v1.Schema$Body | undefined): number {
  let n = 0;
  for (const el of body?.content ?? []) {
    for (const row of el.table?.tableRows ?? []) {
      const cells = row.tableCells ?? [];
      const text = (cells[1]?.content ?? []).map((c) => (c.paragraph?.elements ?? []).map((e) => e.textRun?.content ?? "").join("")).join(" ");
      if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text)) n++;
    }
  }
  return n;
}

/** Cell start indexes (row by row) of every table that starts at or after `fromIndex`, in order. */
function tablesFrom(body: docs_v1.Schema$Body | undefined, fromIndex: number): number[][][] {
  return (body?.content ?? [])
    .filter((el) => el.table && (el.startIndex ?? 0) >= fromIndex)
    .map((el) =>
      (el.table?.tableRows ?? []).map((row) =>
        (row.tableCells ?? []).map((cell) => cell.content?.[0]?.startIndex ?? 0)
      )
    );
}

// ─── Result types ────────────────────────────────────────

export type AgendaDocErrorKind = "not_shared" | "not_found" | "not_configured" | "bad_url" | "other";

export type WriteAgendaDocResult =
  | { ok: true; months: number; rows: number }
  | { ok: false; kind: AgendaDocErrorKind; error: string };

function classifyError(err: unknown): { kind: AgendaDocErrorKind; error: string } {
  const e = err as { code?: number | string; message?: string; response?: { status?: number } };
  const status = Number(e?.response?.status ?? e?.code);
  if (status === 403) {
    return {
      kind: "not_shared",
      error: `El documento no está compartido como Editor con ${serviceAccountEmail()}`,
    };
  }
  if (status === 404) {
    return { kind: "not_found", error: "El documento no existe o el link es incorrecto (404)." };
  }
  const message = e?.message ?? String(err);
  if (message === GOOGLE_NOT_CONFIGURED) return { kind: "not_configured", error: message };
  return { kind: "other", error: message };
}

// ─── Writing ─────────────────────────────────────────────

/**
 * Regenerates the month sections of a client's agenda doc from the portal.
 *
 * Everything from the first "MES ..." paragraph to the end of the body is
 * deleted (the header block above it is preserved), then each month is appended
 * in turn: heading paragraph, empty table, then a single batchUpdate that fills
 * the cells. Filling happens in *descending* index order so that every insert
 * leaves the indexes of the not-yet-filled cells valid.
 *
 * Never throws — failures come back as { ok: false }.
 */
/**
 * PAUSED (Sept 24, 2026): the regenerate-from-portal approach wiped a client Doc that held
 * pautas never imported into the portal. Writes stay disabled until the writer only appends.
 */
export const AGENDA_DOC_WRITES_ENABLED = true;

export async function writeAgendaDoc(clientId: string): Promise<WriteAgendaDocResult> {
  if (!AGENDA_DOC_WRITES_ENABLED) {
    return { ok: false, kind: "other", error: "La sincronización a Google Docs está en pausa mientras se cambia a modo 'solo agregar'. El documento no se modificó." };
  }
  let docs: docs_v1.Docs;
  let documentId: string;
  let sections: AgendaSection[];

  try {
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { agendaDocUrl: true },
    });
    if (!client) return { ok: false, kind: "not_found", error: "Cliente no encontrado." };
    if (!client.agendaDocUrl) {
      return {
        ok: false,
        kind: "bad_url",
        error: "Este cliente no tiene un Google Doc de agenda configurado.",
      };
    }
    const id = extractDocId(client.agendaDocUrl);
    if (!id) {
      return {
        ok: false,
        kind: "bad_url",
        error: "El link del Google Doc no es válido (se espera https://docs.google.com/document/d/<id>/edit).",
      };
    }
    documentId = id;
    docs = getDocsClient();
    sections = await buildAgendaSections(clientId);
    // Never wipe a doc from an empty portal agenda (e.g. a client whose history was not imported).
    if (sections.length === 0) {
      return { ok: false, kind: "other", error: "El portal no tiene pautas para este cliente; el documento no se modificó." };
    }
  } catch (err) {
    return { ok: false, ...classifyError(err) };
  }

  try {
    // ── 1. One write: clear from the first "MES ..." down and append every heading + empty table ──
    const initial = await docs.documents.get({ documentId });
    const body = initial.data.body;
    const cutIndex = findFirstMesIndex(body) ?? bodyEndIndex(body) - 1;
    const end = bodyEndIndex(body) - 1; // the document's final newline cannot be deleted

    // Never destroy information: if the Doc holds more dated rows than the portal knows, refuse.
    const docRows = countDatedRows(body);
    const portalRows = sections.reduce((n, sec) => n + sec.rows.length, 0);
    if (docRows > portalRows) {
      return { ok: false, kind: "other", error: `El Doc tiene ${docRows} pautas y el portal solo ${portalRows}; no se sobrescribe. Importa primero la agenda del Doc al portal.` };
    }

    const build: docs_v1.Schema$Request[] = [];
    if (end > cutIndex) {
      build.push({ deleteContentRange: { range: { startIndex: cutIndex, endIndex: end } } });
    }
    for (const section of sections) {
      build.push({ insertText: { endOfSegmentLocation: {}, text: `${section.heading}\n` } });
      build.push({
        insertTable: {
          endOfSegmentLocation: {},
          rows: section.rows.length + 1,
          columns: AGENDA_TABLE_HEADER.length,
        },
      });
    }
    await docs.documents.batchUpdate({ documentId, requestBody: { requests: build } });

    // ── 2. One read: exact cell indexes of the tables we just appended ──
    const after = await docs.documents.get({ documentId });
    const tables = tablesFrom(after.data.body, cutIndex);
    if (tables.length !== sections.length) {
      return { ok: false, kind: "other", error: `El documento quedó con ${tables.length} tablas y se esperaban ${sections.length}; revísalo manualmente.` };
    }

    // ── 3. One write: fill every cell (descending index order) and bold headings + header rows ──
    const inserts: { index: number; text: string; bold?: boolean }[] = [];
    let totalRows = 0;
    sections.forEach((section, t) => {
      const cellTexts: string[][] = [
        [...AGENDA_TABLE_HEADER],
        ...section.rows.map((r) => [String(r.number), r.fecha, r.hora, r.lugar, r.item, r.estado]),
      ];
      tables[t].forEach((row, rowIdx) => {
        row.forEach((index, colIdx) => {
          const text = cellTexts[rowIdx]?.[colIdx] ?? "";
          if (text) inserts.push({ index, text, bold: rowIdx === 0 });
        });
      });
      totalRows += section.rows.length;
    });
    inserts.sort((a, b) => a.index - b.index);

    const requests: docs_v1.Schema$Request[] = [];
    for (let i = inserts.length - 1; i >= 0; i--) {
      requests.push({ insertText: { location: { index: inserts[i].index }, text: inserts[i].text } });
    }
    // Final positions: each cell shifts by the length of everything inserted before it.
    let shift = 0;
    for (const ins of inserts) {
      if (ins.bold) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: ins.index + shift, endIndex: ins.index + shift + ins.text.length },
            textStyle: { bold: true },
            fields: "bold",
          },
        });
      }
      shift += ins.text.length;
    }
    // Headings sit before the tables, so their indexes are unaffected by the cell inserts.
    for (const section of sections) {
      const hs = findHeadingStart(after.data.body, section.heading);
      if (hs !== null) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: hs, endIndex: hs + section.heading.length },
            textStyle: { bold: true },
            fields: "bold",
          },
        });
      }
    }
    await docs.documents.batchUpdate({ documentId, requestBody: { requests } });

    await db.client.update({ where: { id: clientId }, data: { agendaDocSyncedAt: new Date() } }).catch(() => undefined);
    return { ok: true, months: sections.length, rows: totalRows };
  } catch (err) {
    return { ok: false, ...classifyError(err) };
  }
}

/** Start index of the (last) paragraph whose trimmed text equals the heading. */
function findHeadingStart(body: docs_v1.Schema$Body | undefined, heading: string): number | null {
  let found: number | null = null;
  for (const el of body?.content ?? []) {
    if (!el.paragraph) continue;
    if (paragraphText(el).trim() === heading) found = el.startIndex ?? null;
  }
  return found;
}

// ─── Nightly sync ────────────────────────────────────────

export type AgendaDocSyncEntry = {
  clientId: string;
  client: string;
  ok: boolean;
  months?: number;
  rows?: number;
  kind?: AgendaDocErrorKind;
  error?: string;
};

export type AgendaDocSyncReport = {
  attempted: number;
  updated: number;
  failed: number;
  notShared: number;
  results: AgendaDocSyncEntry[];
};

/**
 * Regenerates the agenda doc of every ACTIVE client that has one. Sequential,
 * with a small pause between clients so we stay well inside the Docs API quota.
 * Never throws: a failing client is recorded and the run continues.
 */
export async function syncAllAgendaDocs(opts: { budgetMs?: number } = {}): Promise<AgendaDocSyncReport> {
  const budgetMs = opts.budgetMs ?? 40_000;
  const startedAt = Date.now();
  const report: AgendaDocSyncReport = {
    attempted: 0,
    updated: 0,
    failed: 0,
    notShared: 0,
    results: [],
  };

  let clients: { id: string; name: string }[] = [];
  try {
    clients = await db.client.findMany({
      where: { status: "ACTIVE", agendaDocUrl: { not: null } },
      select: { id: true, name: true },
      // Least recently synced first, so every doc gets its turn across nights.
      orderBy: [{ agendaDocSyncedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    });
  } catch (err) {
    console.error("syncAllAgendaDocs: could not list clients:", err);
    return report;
  }

  for (const client of clients) {
    if (Date.now() - startedAt > budgetMs) break; // the rest runs tomorrow night
    report.attempted++;
    let result: WriteAgendaDocResult;
    try {
      result = await writeAgendaDoc(client.id);
    } catch (err) {
      // writeAgendaDoc already swallows its own errors; this is belt and braces.
      result = { ok: false, ...classifyError(err) };
    }

    if (result.ok) {
      report.updated++;
      report.results.push({
        clientId: client.id,
        client: client.name,
        ok: true,
        months: result.months,
        rows: result.rows,
      });
    } else {
      report.failed++;
      if (result.kind === "not_shared") report.notShared++;
      report.results.push({
        clientId: client.id,
        client: client.name,
        ok: false,
        kind: result.kind,
        error: result.error,
      });
    }

    if (!result.ok && /quota/i.test(result.error)) break; // Google write quota hit: stop for tonight
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return report;
}
