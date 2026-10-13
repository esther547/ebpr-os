import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, NO_STORE } from "@/lib/cron-auth";
import { buildPitchReminder, pitchReminderHtml, sendEventPitchMilestones, sendPitchReminders, type ReminderMode } from "@/lib/pitch-reminders";

export const dynamic = "force-dynamic";

function modeFrom(req: NextRequest): ReminderMode {
  return req.nextUrl.searchParams.get("mode") === "urgent" ? "urgent" : "full";
}

/** GET ?mode=full|urgent[&format=html] — preview the strategists' pitch reminder (never sends). */
export async function GET(req: NextRequest) {
  const denied = await authorizeCron(req);
  if (denied) return denied;
  // ?milestones=1&send=1[&asOf=yyyy-MM-dd] — send the per-event reminders now (catch-up: as of an earlier day).
  if (req.nextUrl.searchParams.get("milestones") === "1" && req.nextUrl.searchParams.get("send") === "1") {
    const asOf = req.nextUrl.searchParams.get("asOf");
    const now = asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? new Date(`${asOf}T16:00:00Z`) : new Date();
    return NextResponse.json(await sendEventPitchMilestones(now), { headers: NO_STORE });
  }
  const data = await buildPitchReminder(modeFrom(req));
  if (req.nextUrl.searchParams.get("format") === "html") {
    return new NextResponse(pitchReminderHtml(data), { headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE } });
  }
  return NextResponse.json({ preview: true, ...data }, { headers: NO_STORE });
}

/** POST ?mode=full|urgent — send it now (email when configured, plus in-app notifications). */
export async function POST(req: NextRequest) {
  const denied = await authorizeCron(req);
  if (denied) return denied;
  // ?milestones=1 — the individual 40/30/20/15/7-day event reminders instead of the weekly overview.
  const result = req.nextUrl.searchParams.get("milestones") === "1" ? await sendEventPitchMilestones() : await sendPitchReminders(modeFrom(req));
  return NextResponse.json(result, { headers: NO_STORE });
}
