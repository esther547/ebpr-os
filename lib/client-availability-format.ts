// Pure (no DB, no React) helpers for client availability windows, safe to import
// from client components. Windows are expressed with Miami calendar day keys
// ("yyyy-MM-dd"); both ends are inclusive.

export type AvailabilityKindValue = "OFF" | "TRAVEL";

export type AvailabilityWindow = {
  id: string;
  kind: AvailabilityKindValue;
  startKey: string;
  endKey: string;
  location: string | null;
  notes: string | null;
};

/** What the client header needs to show "Off hasta 12 oct" / "En Bogotá hasta 12 oct". */
export type AvailabilityNow = {
  kind: AvailabilityKindValue;
  location: string | null;
  endKey: string;
};

const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function parts(key: string) {
  return { y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) - 1, d: Number(key.slice(8, 10)) };
}

/** "12 oct" */
export function shortDay(key: string): string {
  const { m, d } = parts(key);
  return `${d} ${MONTHS_SHORT[m]}`;
}

/** Compact range: "5–12 oct", "28 sep–3 oct", "5 oct"; adds the year when asked or when it changes. */
export function formatRangeShort(startKey: string, endKey: string, withYear = false): string {
  const a = parts(startKey);
  const b = parts(endKey);
  const showYear = withYear || a.y !== b.y;
  const tail = (p: { y: number }) => (showYear ? ` ${p.y}` : "");
  if (startKey === endKey) return `${a.d} ${MONTHS_SHORT[a.m]}${tail(a)}`;
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS_SHORT[b.m]}${tail(b)}`;
  if (a.y === b.y) return `${a.d} ${MONTHS_SHORT[a.m]}–${b.d} ${MONTHS_SHORT[b.m]}${tail(b)}`;
  return `${a.d} ${MONTHS_SHORT[a.m]} ${a.y}–${b.d} ${MONTHS_SHORT[b.m]} ${b.y}`;
}

/** Spanish long range: "del 5 al 12 de octubre", "del 28 de septiembre al 3 de octubre", "el 5 de octubre". */
export function formatRangeLong(startKey: string, endKey: string): string {
  const a = parts(startKey);
  const b = parts(endKey);
  if (startKey === endKey) return `el ${a.d} de ${MONTHS_LONG[a.m]}`;
  if (a.y !== b.y) {
    return `del ${a.d} de ${MONTHS_LONG[a.m]} de ${a.y} al ${b.d} de ${MONTHS_LONG[b.m]} de ${b.y}`;
  }
  if (a.m === b.m) return `del ${a.d} al ${b.d} de ${MONTHS_LONG[b.m]}`;
  return `del ${a.d} de ${MONTHS_LONG[a.m]} al ${b.d} de ${MONTHS_LONG[b.m]}`;
}

/**
 * OFF:    "no disponible del 5 al 12 de octubre (vacaciones)"
 * TRAVEL: "de viaje en Bogotá del 5 al 12 de octubre"
 */
export function describeWindow(
  w: Pick<AvailabilityWindow, "kind" | "startKey" | "endKey" | "location" | "notes">
): string {
  const range = formatRangeLong(w.startKey, w.endKey);
  if (w.kind === "OFF") {
    const reason = w.notes?.trim();
    return `no disponible ${range}${reason ? ` (${reason})` : ""}`;
  }
  const place = w.location?.trim();
  return `de viaje${place ? ` en ${place}` : ""} ${range}`;
}

/** Header badge text: "Off hasta 12 oct" / "En Bogotá hasta 12 oct". */
export function availabilityBadgeLabel(now: AvailabilityNow): string {
  const until = `hasta ${shortDay(now.endKey)}`;
  if (now.kind === "OFF") return `Off ${until}`;
  return now.location?.trim() ? `En ${now.location.trim()} ${until}` : `De viaje ${until}`;
}

/** Short label for a window in lists: "Off 5–12 oct" / "Viaje Bogotá 20–24 oct". */
export function windowShortLabel(w: Pick<AvailabilityWindow, "kind" | "startKey" | "endKey" | "location">): string {
  const range = formatRangeShort(w.startKey, w.endKey);
  if (w.kind === "OFF") return `Off ${range}`;
  return `Viaje${w.location?.trim() ? ` ${w.location.trim()}` : ""} ${range}`;
}
