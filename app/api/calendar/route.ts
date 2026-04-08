import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public iCal feed — accessed via token for Google Calendar / Apple Calendar sync
// URL: /api/calendar?token=USER_ID or /api/calendar?client=CLIENT_ID

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("token");
  const clientId = searchParams.get("client");

  if (!userId && !clientId) {
    return new NextResponse("Missing token or client parameter", { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (userId) where.runnerId = userId;
  if (clientId) where.clientId = clientId;

  const assignments = await db.runnerAssignment.findMany({
    where: { ...where, status: { not: "CANCELLED" } },
    include: {
      runner: { select: { name: true, email: true } },
    },
    orderBy: { eventDate: "asc" },
  });

  // Also get deliverables if client-based
  let deliverables: { id: string; title: string; dueDate: Date | null; type: string; status: string; client: { name: string } }[] = [];
  if (clientId) {
    deliverables = await db.deliverable.findMany({
      where: { clientId, status: { not: "CANCELLED" }, dueDate: { not: null } },
      select: { id: true, title: true, dueDate: true, type: true, status: true, client: { select: { name: true } } },
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
    `X-WR-CALNAME:EBPR ${userId ? "Runner Schedule" : "Client Calendar"}`,
  ];

  for (const a of assignments) {
    const dtStart = formatICalDate(a.eventDate);
    const dtEnd = formatICalDate(new Date(new Date(a.eventDate).getTime() + 2 * 60 * 60 * 1000)); // 2hr default

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:ebpr-assignment-${a.id}@ebpublicrelations.com`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcal(a.eventName)}`);
    lines.push(`DESCRIPTION:${escapeIcal([
      a.notes,
      a.venueName ? `Venue: ${a.venueName}` : null,
      a.venueAddress ? `Address: ${a.venueAddress}` : null,
      `Runner: ${a.runner.name}`,
      `Status: ${a.status}`,
    ].filter(Boolean).join("\\n"))}`);
    if (a.venueAddress) lines.push(`LOCATION:${escapeIcal(a.venueAddress)}`);
    else if (a.location) lines.push(`LOCATION:${escapeIcal(a.location)}`);
    lines.push(`STATUS:${a.status === "COMPLETED" ? "COMPLETED" : "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }

  for (const d of deliverables) {
    if (!d.dueDate) continue;
    const dtStart = formatICalDate(d.dueDate);
    const dtEnd = formatICalDate(new Date(new Date(d.dueDate).getTime() + 60 * 60 * 1000));

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:ebpr-deliverable-${d.id}@ebpublicrelations.com`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:[${d.type}] ${escapeIcal(d.title)}`);
    lines.push(`DESCRIPTION:Client: ${escapeIcal(d.client.name)}\\nStatus: ${d.status}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=ebpr-calendar.ics",
    },
  });
}

function formatICalDate(d: Date | string): string {
  const date = new Date(d);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcal(s: string): string {
  return s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}
