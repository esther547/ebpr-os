import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * Cron routes are public in middleware so Vercel can call them.
 * They must be protected by CRON_SECRET (Vercel sends `Authorization: Bearer <CRON_SECRET>`).
 * A signed-in SUPER_ADMIN may also trigger them manually from the browser.
 * If CRON_SECRET is not configured, only a SUPER_ADMIN can run them.
 */
export async function authorizeCron(req: NextRequest): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (secret && header === `Bearer ${secret}`) return null;

  const user = await getCurrentUser().catch(() => null);
  if (user?.role === "SUPER_ADMIN") return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;
