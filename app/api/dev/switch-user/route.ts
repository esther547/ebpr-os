import { NextRequest, NextResponse } from "next/server";
import { DEV_AUTH_BYPASS, ROLE_HOME } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * LOCAL-ONLY: switch the acting user for manual testing.
 *   /api/dev/switch-user?email=juanita@ebpublicrelations.com
 *   /api/dev/switch-user?clear=1
 * Returns 404 unless NODE_ENV=development and DEV_AUTH_BYPASS=1.
 */
export async function GET(req: NextRequest) {
  if (!DEV_AUTH_BYPASS) return new NextResponse("Not found", { status: 404 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("clear")) {
    const res = NextResponse.redirect(new URL("/sign-in", req.url));
    res.cookies.delete("ebpr_dev_user");
    return res;
  }

  const email = searchParams.get("email");
  if (!email) {
    const users = await db.user.findMany({ select: { email: true, name: true, role: true }, orderBy: { role: "asc" } });
    return NextResponse.json({ usage: "?email=<one of these>", users });
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "No such user" }, { status: 404 });

  const res = NextResponse.redirect(new URL(ROLE_HOME[user.role], req.url));
  res.cookies.set("ebpr_dev_user", email, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
