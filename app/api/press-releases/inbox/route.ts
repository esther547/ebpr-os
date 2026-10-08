import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManagePressReleases } from "@/lib/permissions";
import { authorizeCron, NO_STORE } from "@/lib/cron-auth";
import { peekPressInbox, processPressInbox, recleanRelease } from "@/lib/press-inbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST (press team, from the portal button): read press@ and create pending releases + tests. */
export async function POST() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManagePressReleases(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const result = await processPressInbox();
  if (result.error) return NextResponse.json({ error: result.error, ...result }, { status: 400, headers: NO_STORE });
  return NextResponse.json(result, { headers: NO_STORE });
}

/** GET (cron / super admin): same thing. */
export async function GET(req: NextRequest) {
  const denied = await authorizeCron(req);
  if (denied) return denied;
  const reclean = req.nextUrl.searchParams.get("reclean");
  if (reclean) return NextResponse.json(await recleanRelease(reclean), { headers: NO_STORE });
  if (req.nextUrl.searchParams.get("peek") === "1") return NextResponse.json(await peekPressInbox(Number(req.nextUrl.searchParams.get("limit") || 3)), { headers: NO_STORE });
  const result = await processPressInbox();
  return NextResponse.json(result, { status: result.error ? 400 : 200, headers: NO_STORE });
}
