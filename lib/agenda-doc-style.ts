/**
 * Visual template of the agency's "Agenda 2026" Google Docs, measured on an untouched original
 * (NAVI's doc) through the Docs API. Pure request builders — no DB, no auth — so both the
 * portal writer (lib/google-docs-writer.ts) and scripts/append-agenda-row.ts share them.
 *
 * Layout: ONE 6-column table for the whole agenda. Each month is a block of rows:
 *   month row  — all six cells merged, teal, "MES N (NOMBRE)" bold white centered, min 20pt
 *   header row — "#", "FECHA", "HORA", "LUGAR", "ITEM", "ESTADO", dark teal, bold white
 *   data rows  — "#" cell blue-grey + bold, the rest light grey + centered, min 29.052pt
 * Every cell: 5pt padding, 1pt white borders, top aligned, Nunito 9pt, line spacing 100.
 * Measured values live in the constants below; see BASE_CELL_STYLE for why padding is not sent.
 */
import type { docs_v1 } from "googleapis";

type Request = docs_v1.Schema$Request;
type OptionalColor = docs_v1.Schema$OptionalColor;

export const AGENDA_COLUMN_WIDTHS_PT = [25.5, 84.75, 68.25, 93.75, 203.25, 69.75] as const;
export const AGENDA_FONT = "Nunito";
export const AGENDA_FONT_SIZE_PT = 9;
export const MONTH_ROW_MIN_HEIGHT_PT = 20;
export const DATA_ROW_MIN_HEIGHT_PT = 29.052;

const rgb = (red: number, green: number, blue: number): OptionalColor => ({ color: { rgbColor: { red, green, blue } } });
export const WHITE = rgb(1, 1, 1);
export const MONTH_ROW_BG = rgb(0.07450981, 0.30980393, 0.36078432);
export const HEADER_ROW_BG = rgb(0.047058824, 0.20392157, 0.23921569);
export const NUMBER_CELL_BG = rgb(0.8156863, 0.8784314, 0.8901961);
export const DATA_CELL_BG = rgb(0.9372549, 0.9372549, 0.9372549);

const pt = (magnitude: number) => ({ magnitude, unit: "PT" });
const whiteBorder = { color: WHITE, width: pt(1), dashStyle: "SOLID" };

/**
 * White 1pt borders on every cell. Padding (5pt) and top alignment are NOT sent: a fresh
 * insertTable / insertTableRow already carries them explicitly (exactly like the template), and
 * writing the default value back makes the API drop the explicit field instead of storing it.
 */
const BASE_CELL_STYLE: docs_v1.Schema$TableCellStyle = {
  borderLeft: whiteBorder,
  borderRight: whiteBorder,
  borderTop: whiteBorder,
  borderBottom: whiteBorder,
};
const BASE_CELL_FIELDS = "borderLeft,borderRight,borderTop,borderBottom";

const loc = (tableStart: number, rowIndex: number, columnIndex: number) => ({
  tableStartLocation: { index: tableStart },
  rowIndex,
  columnIndex,
});

/** White borders plus a background on a rectangle of cells. */
export function cellBlockStyle(
  tableStart: number,
  rowIndex: number,
  rowSpan: number,
  columnIndex: number,
  columnSpan: number,
  background: OptionalColor
): Request {
  return {
    updateTableCellStyle: {
      tableRange: { tableCellLocation: loc(tableStart, rowIndex, columnIndex), rowSpan, columnSpan },
      tableCellStyle: { ...BASE_CELL_STYLE, backgroundColor: background },
      fields: `${BASE_CELL_FIELDS},backgroundColor`,
    },
  };
}

export function rowHeightStyle(tableStart: number, rowIndices: number[], heightPt: number): Request {
  return {
    updateTableRowStyle: {
      tableStartLocation: { index: tableStart },
      rowIndices,
      tableRowStyle: { minRowHeight: pt(heightPt) },
      fields: "minRowHeight",
    },
  };
}

/** One updateTableColumnProperties per column: the API applies a single width to all listed indices. */
export function columnWidthRequests(tableStart: number): Request[] {
  return AGENDA_COLUMN_WIDTHS_PT.map((width, i) => ({
    updateTableColumnProperties: {
      tableStartLocation: { index: tableStart },
      columnIndices: [i],
      tableColumnProperties: { widthType: "FIXED_WIDTH", width: pt(width) },
      fields: "widthType,width",
    },
  }));
}

export function mergeRowRequest(tableStart: number, rowIndex: number, columns: number): Request {
  return {
    mergeTableCells: {
      tableRange: { tableCellLocation: loc(tableStart, rowIndex, 0), rowSpan: 1, columnSpan: columns },
    },
  };
}

/** Styles of a whole data row: "#" cell + five content cells, and its min height. */
export function dataRowCellRequests(tableStart: number, rowIndex: number, columns: number): Request[] {
  return [
    cellBlockStyle(tableStart, rowIndex, 1, 0, 1, NUMBER_CELL_BG),
    cellBlockStyle(tableStart, rowIndex, 1, 1, columns - 1, DATA_CELL_BG),
    rowHeightStyle(tableStart, [rowIndex], DATA_ROW_MIN_HEIGHT_PT),
  ];
}

/**
 * Paragraph + text defaults for a text range (the whole agenda table, or one row): centered,
 * line spacing 100, Nunito 9pt, not bold, default (black) color, no underline/link.
 * Fields listed without a value are reset to the inherited value.
 */
export function baseTextRequests(startIndex: number, endIndex: number): Request[] {
  const range = { startIndex, endIndex };
  return [
    {
      updateParagraphStyle: {
        range,
        paragraphStyle: {
          alignment: "CENTER",
          lineSpacing: 100,
          spaceAbove: pt(0),
          spaceBelow: pt(0),
          indentFirstLine: pt(0),
          indentStart: pt(0),
          avoidWidowAndOrphan: false,
        },
        fields: "alignment,lineSpacing,spaceAbove,spaceBelow,indentFirstLine,indentStart,avoidWidowAndOrphan",
      },
    },
    {
      updateTextStyle: {
        range,
        textStyle: {
          bold: false,
          weightedFontFamily: { fontFamily: AGENDA_FONT, weight: 400 },
          fontSize: pt(AGENDA_FONT_SIZE_PT),
        },
        fields: "bold,italic,underline,strikethrough,foregroundColor,backgroundColor,link,weightedFontFamily,fontSize",
      },
    },
  ];
}

export type CellFill = {
  /** Start index of the (empty) cell's first paragraph, as read from the doc before filling. */
  index: number;
  text: string;
  /** "all": whole text bold; "firstLine": only up to the first newline; "none": regular. */
  bold: "all" | "firstLine" | "none";
  white?: boolean;
  /** Paragraph alignment; the base is CENTER so only START needs a request. */
  align: "START" | "CENTER";
};

/**
 * Inserts the texts of a set of empty cells and styles them. Returns the insert requests
 * (descending index order, so every insert leaves the not-yet-filled indexes valid), the style
 * requests (indexes already shifted by the inserted text, so they must run AFTER the inserts and
 * after any base style), and the total number of characters inserted.
 */
export function fillCellRequests(cells: CellFill[]): { inserts: Request[]; styles: Request[]; inserted: number } {
  const sorted = [...cells].sort((a, b) => a.index - b.index);
  const inserts: Request[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].text) inserts.push({ insertText: { location: { index: sorted[i].index }, text: sorted[i].text } });
  }

  const styles: Request[] = [];
  let shift = 0;
  for (const cell of sorted) {
    const start = cell.index + shift;
    const len = cell.text.length;
    if (cell.align === "START") {
      styles.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: start + len + 1 },
          paragraphStyle: { alignment: "START" },
          fields: "alignment",
        },
      });
    }
    const boldLen = cell.bold === "all" ? len : cell.bold === "firstLine" ? cell.text.split("\n")[0].length : 0;
    if (boldLen > 0) {
      styles.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: start + boldLen },
          textStyle: { bold: true },
          fields: "bold",
        },
      });
    }
    if (cell.white && len > 0) {
      styles.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: start + len },
          textStyle: { foregroundColor: WHITE },
          fields: "foregroundColor",
        },
      });
    }
    shift += len;
  }
  return { inserts, styles, inserted: shift };
}
