/**
 * Pieces shared by the Google Doc agenda writer (lib/google-docs-writer.ts) and the
 * append-only sync (lib/agenda-doc-append.ts). Lives apart so neither imports the other.
 */
import { google } from "googleapis";
import type { docs_v1 } from "googleapis";
import { GOOGLE_NOT_CONFIGURED, getGoogleCredentials } from "@/lib/google-docs";
import { dayOfWeekForKey, minutesOfDayInTz } from "@/components/runners/miami-time";

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

export type AgendaDocErrorKind = "not_shared" | "not_found" | "not_configured" | "bad_url" | "other";

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
