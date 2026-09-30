/** "Add to Google Calendar" links for a pauta (no OAuth: Google's event template URL). Client-safe. */

type PautaLike = {
  eventName: string;
  eventDate: string | Date;
  arrivalTime?: string | Date | null;
  eventTime?: string | Date | null;
  venueName?: string | null;
  venueAddress?: string | null;
  location?: string | null;
  clientName?: string | null;
  itemType?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
};

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** Event window: starts at arrival (or the pauta time) and runs through on-air + 2h, like the iCal feed. */
export function eventWindow(p: PautaLike): { start: Date; end: Date } {
  const eventDate = new Date(p.eventDate);
  const start = p.arrivalTime ? new Date(p.arrivalTime) : eventDate;
  const main = p.eventTime ? new Date(p.eventTime) : eventDate;
  return { start, end: new Date(Math.max(main.getTime(), start.getTime()) + 2 * 60 * 60 * 1000) };
}

export function googleCalendarUrl(p: PautaLike): string {
  const { start, end } = eventWindow(p);
  const details = [
    p.clientName ? `Cliente: ${p.clientName}` : null,
    p.itemType ? `Tipo: ${p.itemType}` : null,
    p.venueName ? `Lugar: ${p.venueName}` : null,
    p.venueAddress ? `Dirección: ${p.venueAddress}` : null,
    p.internalNotes ? `\nNotas internas:\n${p.internalNotes}` : null,
    p.notes ? `\nNotas:\n${p.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${p.clientName ? `${p.clientName} · ` : ""}${p.eventName}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    details,
    location: [p.venueName, p.venueAddress].filter(Boolean).join(", ") || p.location || "",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
