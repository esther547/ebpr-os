import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, NO_STORE } from "@/lib/cron-auth";
import { buildPitchReminder, pitchReminderHtml, sendPitchReminders, type ReminderMode } from "@/lib/pitch-reminders";

export const dynamic = "force-dynamic";

function modeFrom(req: NextRequest): ReminderMode {
  return req.nextUrl.searchParams.get("mode") === "urgent" ? "urgent" : "full";
}

/** GET ?mode=full|urgent[&format=html] — preview the strategists' pitch reminder (never sends). */
export async function GET(req: NextRequest) {
  const denied = await authorizeCron(req);
  if (denied) return denied;
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
  const result = await sendPitchReminders(modeFrom(req));
  return NextResponse.json(result, { headers: NO_STORE });
}
