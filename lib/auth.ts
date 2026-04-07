import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string | null;
};

/**
 * Get the current internal user from the database.
 * Auto-creates the user record on first sign-in.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  // Try to find existing user
  let user = await db.user.findUnique({
    where: { clerkId: userId },
    select: {
      id: true,
      clerkId: true,
      email: true,
      name: true,
      role: true,
      avatar: true,
    },
  });

  // Auto-link or auto-create on first sign-in
  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email.split("@")[0];

    // Check if a user with this email already exists (added by admin)
    const existingByEmail = await db.user.findUnique({ where: { email } });

    if (existingByEmail) {
      // Link their Clerk ID to the existing account
      user = await db.user.update({
        where: { id: existingByEmail.id },
        data: {
          clerkId: userId,
          name: name || existingByEmail.name,
          avatar: clerkUser.imageUrl,
        },
        select: {
          id: true,
          clerkId: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
        },
      });
    } else {
      // Brand new user — first user is SUPER_ADMIN, rest are STRATEGIST
      const userCount = await db.user.count();
      const role = userCount === 0 ? UserRole.SUPER_ADMIN : UserRole.STRATEGIST;

      user = await db.user.create({
        data: {
          clerkId: userId,
          email,
          name,
          role,
          avatar: clerkUser.imageUrl,
        },
        select: {
          id: true,
          clerkId: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
        },
      });
    }
  }

  return user;
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
 * Require the user to have one of the given roles.
 */
export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new Error(`Forbidden: requires one of ${roles.join(", ")}`);
  }
  return user;
}

export const INTERNAL_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.STRATEGIST,
  UserRole.RUNNER,
  UserRole.LEGAL,
  UserRole.FINANCE,
];

export const CLIENT_ROLES: UserRole[] = [
  UserRole.CLIENT_ADMIN,
  UserRole.CLIENT_VIEWER,
];
