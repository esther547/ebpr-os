import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/clerk(.*)",
  "/sign/(.*)",      // public contract signing pages
  "/monitor/(.*)",   // public campaign monitor pages
  "/api/cron(.*)",   // cron job endpoint
]);

const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isRunnerPortalRoute = createRouteMatcher(["/runner-portal(.*)"]);
const isAssistantPortalRoute = createRouteMatcher(["/assistant-portal(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();

  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const url = req.nextUrl.pathname;

  // ── Client portal users → /portal only
  if (role === "CLIENT_ADMIN" || role === "CLIENT_VIEWER") {
    if (!isPortalRoute(req)) {
      return NextResponse.redirect(new URL("/portal", req.url));
    }
    return NextResponse.next();
  }

  // ── Runners → external runner portal only
  if (role === "RUNNER") {
    if (!isRunnerPortalRoute(req) && !url.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/runner-portal", req.url));
    }
    return NextResponse.next();
  }

  // ── Assistant (Carolina) → follow-up tab only
  if (role === "ASSISTANT") {
    const allowed = url.startsWith("/follow-up") || url.startsWith("/api/") || isAssistantPortalRoute(req);
    if (!allowed) {
      return NextResponse.redirect(new URL("/follow-up", req.url));
    }
    return NextResponse.next();
  }

  // ── Block internal users from external portals
  if (isPortalRoute(req) || isRunnerPortalRoute(req) || isAssistantPortalRoute(req)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // ── Strategist → Dashboard, Clients, Runners only
  if (role === "STRATEGIST") {
    const allowed = url === "/" || url.startsWith("/dashboard") || url.startsWith("/clients") || url.startsWith("/runners") || url.startsWith("/press-releases") || url.startsWith("/journalists");
    if (!allowed && !url.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // ── Legal (Jessica) → Legal + Finance + Follow-Up only (NO dashboard)
  if (role === "LEGAL") {
    const allowed = url.startsWith("/legal") || url.startsWith("/finance") || url.startsWith("/follow-up");
    if (!allowed && !url.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/legal", req.url));
    }
  }

  // ── Finance (Laurie) → Finance + Follow-Up only (NO dashboard)
  if (role === "FINANCE") {
    const allowed = url.startsWith("/finance") || url.startsWith("/follow-up");
    if (!allowed && !url.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/finance", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
