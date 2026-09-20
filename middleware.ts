import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/access-pending(.*)",
  "/api/dev/(.*)",     // local-only role switcher (404 in production)
  "/api/webhooks(.*)",
  "/api/clerk(.*)",
  "/sign/(.*)",        // public contract signing pages
  "/api/sign/(.*)",    // public contract signing API
  "/monitor/(.*)",     // public campaign monitor pages
  "/api/cron(.*)",     // cron job endpoint (protected by CRON_SECRET)
  "/api/digest(.*)",   // weekly digest cron (protected by CRON_SECRET)
  "/api/calendar(.*)", // iCal feed (protected by per-user token)
]);

const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isRunnerPortalRoute = createRouteMatcher(["/runner-portal(.*)"]);
const isAssistantPortalRoute = createRouteMatcher(["/assistant-portal(.*)"]);

// Local-only role switcher (see lib/auth.ts). Inert in production builds.
const DEV_AUTH_BYPASS =
  process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";

/** Pass the pathname to server layouts so they can enforce roles from the DB. */
function next(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return next(req);

  if (DEV_AUTH_BYPASS && req.cookies.get("ebpr_dev_user")?.value) {
    // Role enforcement happens in the route-group layouts against the DB role.
    return next(req);
  }

  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // First line of defense only: Clerk session metadata (if set).
  // The authoritative role check is done in each route-group layout using the DB role.
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const url = req.nextUrl.pathname;

  if (role === "CLIENT_ADMIN" || role === "CLIENT_VIEWER") {
    if (!isPortalRoute(req) && !url.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/portal", req.url));
    }
    return next(req);
  }

  if (role === "RUNNER") {
    if (!isRunnerPortalRoute(req) && !url.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/runner-portal", req.url));
    }
    return next(req);
  }

  if (role === "ASSISTANT") {
    const allowed = url.startsWith("/follow-up") || url.startsWith("/api/") || isAssistantPortalRoute(req);
    if (!allowed) {
      return NextResponse.redirect(new URL("/follow-up", req.url));
    }
    return next(req);
  }

  return next(req);
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
