import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public iCal feed — accessed via token for Google Calendar / Apple Calendar sync.
//   Runner feed:  /api/calendar?token=USER_ID        (only that runner's own assignments)
//   Client feed:  /api/calendar?client=SHARE_TOKEN   (the client's public monitor token;
//                 client-visible deliverables + agenda, no runner identities)

export const dynamic = "force-dynamic";

type Assignment = {
  id: string;
  eventName: string;
  eventDate: Date;
  arrivalTime: Date | null;
  eventTime: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  clientId: string | null;
  itemType: string | null;
  updatedAt: Date;
};

const assignmentSelect = {
  id: true,
  eventName: true,
  eventDate: true,
  arrivalTime: true,
  eventTime: true,
  venueName: true,
  venueAddress: true,
  location: true,
  notes: true,
  status: true,
  clientId: true,
  itemType: true,
  updatedAt: true,
} as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("token");
  const clientToken = searchParams.get("client");

  if (!userId && !clientToken) {
    return new NextResponse("Missing token or client parameter", { status: 400 });
  }

  let assignments: Assignment[] = [];
  let deliverables: { id: string; title: string; dueDate: Date | null; type: string; status: string; updatedAt: Date }[] = [];
  let calendarName = "EBPR";
  let clientNames = new Map<string, string>();
  let isRunnerFeed = false;

  if (userId) {
    // Per-runner feed: scoped strictly to this user's own assignments
    const runner = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, isActive: true },
    });
    if (!runner || !runner.isActive) {
      return new NextResponse("Invalid token", { status: 404 });
    }
    isRunnerFeed = true;
    calendarName = `EBPR Runner Schedule — ${runner.name}`;
    assignments = await db.runnerAssignment.findMany({
      where: { runnerId: runner.id, status: { not: "CANCELLED" } },
      select: assignmentSelect,
      orderBy: { eventDate: "asc" },
    });
    const clientIds = Array.from(new Set(assignments.map((a) => a.clientId).filter((x): x is string => !!x)));
    if (clientIds.length) {
      const clients = await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } });
      clientNames = new Map(clients.map((c) => [c.id, c.name]));
    }
  } else if (clientToken) {
    // Client feed: resolved by the public share token (same as the campaign monitor),
    // never by the internal client id.
    const client = await db.client.findUnique({
      where: { shareToken: clientToken },
      select: { id: true, name: true },
    });
    if (!client) {
      return new NextResponse("Invalid token", { status: 404 });
    }
    calendarName = `EBPR — ${client.name}`;
    assignments = await db.runnerAssignment.findMany({
      where: { clientId: client.id, status: { not: "CANCELLED" } },
      select: assignmentSelect,
      orderBy: { eventDate: "asc" },
    });
    deliverables = await db.deliverable.findMany({
      where: {
        clientId: client.id,
        isClientVisible: true,
        isInternal: false,
        status: { not: "CANCELLED" },
        dueDate: { not: null },
      },
      select: { id: true, title: true, dueDate: true, type: true, status: true, updatedAt: true },
      orderBy: { dueDate: "asc" },
    });
  }

  // Build iCal
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EBPR OS//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcal(calendarName)}`,
    "X-WR-TIMEZONE:America/New_York",
  ];

  for (const a of assignments) {
    // The event starts at arrival (if set) and runs through on-air + 2h.
    const start = a.arrivalTime ?? a.eventDate;
    const main = a.eventTime ?? a.eventDate;
    const end = new Date(Math.max(main.getTime(), start.getTime()) + 2 * 60 * 60 * 1000);

    const description = [
      a.clientId && clientNames.get(a.clientId) ? `Client: ${clientNames.get(a.clientId)}` : null,
      a.itemType ? `Type: ${a.itemType}` : null,
      a.arrivalTime ? `Arrival: ${formatLocalTime(a.arrivalTime)}` : null,
      a.eventTime ? `On air: ${formatLocalTime(a.eventTime)}` : null,
      a.venueName ? `Venue: ${a.venueName}` : null,
      a.venueAddress ? `Address: ${a.venueAddress}` : null,
      // Logistics notes are for the runner only; the client feed omits them
      isRunnerFeed && a.notes ? a.notes : null,
      `Status: ${a.status}`,
    ].filter(Boolean).join("\n");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:ebpr-assignment-${a.id}@ebpublicrelations.com`);
    lines.push(`DTSTAMP:${formatICalDate(a.updatedAt)}`);
    lines.push(`DTSTART:${formatICalDate(start)}`);
    lines.push(`DTEND:${formatICalDate(end)}`);
    lines.push(`SUMMARY:${escapeIcal(a.eventName)}`);
    lines.push(`DESCRIPTION:${escapeIcal(description)}`);
    const location = [a.venueName, a.venueAddress || a.location].filter(Boolean).join(", ");
    if (location) lines.push(`LOCATION:${escapeIcal(location)}`);
    lines.push(`STATUS:${a.status === "COMPLETED" ? "CONFIRMED" : a.status === "CONFIRMED" ? "CONFIRMED" : "TENTATIVE"}`);
    lines.push("END:VEVENT");
  }

  for (const d of deliverables) {
    if (!d.dueDate) continue;
    const dtStart = formatICalDate(d.dueDate);
    const dtEnd = formatICalDate(new Date(d.dueDate.getTime() + 60 * 60 * 1000));

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:ebpr-deliverable-${d.id}@ebpublicrelations.com`);
    lines.push(`DTSTAMP:${formatICalDate(d.updatedAt)}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcal(`[${d.type.replace(/_/g, " ")}] ${d.title}`)}`);
    lines.push(`DESCRIPTION:${escapeIcal(`Status: ${d.status}`)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.map(foldLine).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=ebpr-calendar.ics",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function formatICalDate(d: Date | string): string {
  const date = new Date(d);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatLocalTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function escapeIcal(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545: content lines longer than 75 octets must be folded
function foldLine(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 75) {
    let cut = 75;
    while (cut > 0 && Buffer.byteLength(rest.slice(0, cut), "utf8") > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}
