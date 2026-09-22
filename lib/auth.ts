import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { FEATURES } from "@/lib/features";

export type SessionUser = {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string | null;
};

const userSelect = {
  id: true,
  clerkId: true,
  email: true,
  name: true,
  role: true,
  avatar: true,
} as const;

/**
 * Local-only role switcher for testing.
 * Active ONLY when NODE_ENV is "development" AND DEV_AUTH_BYPASS=1.
 * Reads the email of a seeded user from the `ebpr_dev_user` cookie.
 * Production builds on Vercel run with NODE_ENV=production, so this is inert there.
 */
export const DEV_AUTH_BYPASS =
  process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";

function devUserEmail(): string | null {
  if (!DEV_AUTH_BYPASS) return null;
  try {
    return cookies().get("ebpr_dev_user")?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the current internal user from the database.
 *
 * Access model: team members are added by Esther in Settings (by email).
 * On first sign-in, the Clerk account is linked to that pre-existing record.
 * Unknown sign-ups are NOT given access (the only exception is bootstrapping
 * the very first user of an empty database, who becomes SUPER_ADMIN).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const devEmail = devUserEmail();
  if (devEmail) {
    return db.user.findUnique({ where: { email: devEmail }, select: userSelect });
  }

  const { userId } = await auth();
  if (!userId) return null;

  let user = await db.user.findUnique({
    where: { clerkId: userId },
    select: userSelect,
  });
  if (user) return user;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const emails = clerkUser.emailAddresses.map((e) => e.emailAddress.toLowerCase());
  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? emails[0] ?? "";
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    primaryEmail.split("@")[0];

  // Link to a record an admin already created for this email (case-insensitive)
  const existingByEmail = emails.length
    ? await db.user.findFirst({
        where: { email: { in: emails, mode: "insensitive" } },
      })
    : null;

  if (existingByEmail) {
    if (!existingByEmail.isActive) return null;
    user = await db.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkId: userId,
        name: existingByEmail.name || name,
        avatar: clerkUser.imageUrl,
      },
      select: userSelect,
    });
    return user;
  }

  // Bootstrap: the first ever user of an empty database becomes SUPER_ADMIN.
  const userCount = await db.user.count();
  if (userCount === 0) {
    return db.user.create({
      data: {
        clerkId: userId,
        email: primaryEmail,
        name,
        role: UserRole.SUPER_ADMIN,
        avatar: clerkUser.imageUrl,
      },
      select: userSelect,
    });
  }

  // Unknown account: no access until an admin adds this email in Settings.
  return null;
}

/**
 * Get the current client portal user from the database.
 */
export async function getCurrentClientUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const clientUser = await db.clientUser.findUnique({
    where: { clerkId: userId },
    include: {
      client: { select: { id: true, name: true, slug: true, logo: true } },
    },
  });

  if (!clientUser || !clientUser.isActive) return null;
  return clientUser;
}

/**
 * Require an authenticated internal user.
 * Throws if not found.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/**
 * Require an authenticated user with one of the given roles.
 */
export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("Forbidden");
  return user;
}

export const INTERNAL_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.STRATEGIST,
  UserRole.RUNNER,
  UserRole.LEGAL,
  UserRole.FINANCE,
  UserRole.ASSISTANT,
];

export const CLIENT_ROLES: UserRole[] = [
  UserRole.CLIENT_ADMIN,
  UserRole.CLIENT_VIEWER,
];

/**
 * Where each role lands after sign-in, and which URL prefixes it may open.
 * Used by the route-group layouts (the source of truth is the DB role, not Clerk metadata).
 */
export const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN: "/dashboard",
  STRATEGIST: "/dashboard",
  LEGAL: FEATURES.legal ? "/legal" : "/paused",
  FINANCE: FEATURES.legal ? "/follow-up" : "/paused",
  ASSISTANT: FEATURES.legal ? "/follow-up" : "/paused",
  RUNNER: "/runner-portal",
  CLIENT_ADMIN: "/portal",
  CLIENT_VIEWER: "/portal",
};

const ROLE_PREFIXES: Record<UserRole, string[]> = {
  SUPER_ADMIN: ["/"],
  STRATEGIST: ["/dashboard", "/priorities", "/clients", "/runners", "/press-releases", "/journalists", "/reports"],
  LEGAL: ["/legal", "/follow-up", "/paused"],
  FINANCE: ["/follow-up", "/paused"],
  ASSISTANT: ["/follow-up", "/assistant-portal", "/paused"],
  RUNNER: ["/runner-portal"],
  CLIENT_ADMIN: ["/portal"],
  CLIENT_VIEWER: ["/portal"],
};

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const prefixes = ROLE_PREFIXES[role] ?? [];
  return prefixes.some(
    (p) => p === "/" || pathname === p || pathname.startsWith(p + "/")
  );
}
