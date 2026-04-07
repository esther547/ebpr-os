import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/clerk(.*)",
]);

const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isInternalRoute = createRouteMatcher([
  "/",
  "/clients(.*)",
  "/legal(.*)",
  "/runners(.*)",
  "/reports(.*)",
  "/settings(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();

  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;

  // Client portal users can only access /portal
  if (role === "CLIENT_ADMIN" || role === "CLIENT_VIEWER") {
    if (!isPortalRoute(req)) {
      return NextResponse.redirect(new URL("/portal", req.url));
    }
    return NextResponse.next();
  }

  // Internal users cannot access /portal
  if (isPortalRoute(req)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Runner: only schedule + their own assignments
  if (role === "RUNNER" && isInternalRoute(req)) {
    const url = req.nextUrl.pathname;
    if (!url.startsWith("/runners")) {
      return NextResponse.redirect(new URL("/runners/schedule", req.url));
    }
  }

  // Legal: only /legal
  if (role === "LEGAL") {
    const url = req.nextUrl.pathname;
    if (url !== "/" && !url.startsWith("/legal")) {
      return NextResponse.redirect(new URL("/legal", req.url));
    }
  }

  // Finance: only /reports + limited client view
  if (role === "FINANCE") {
    const url = req.nextUrl.pathname;
    if (!url.startsWith("/reports") && !url.startsWith("/clients")) {
      return NextResponse.redirect(new URL("/reports", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
