import type { UserRole } from "@prisma/client";

/**
 * Who can accompany a client to an activity ("acompañar a pautas").
 * Runners always; strategists and admins when it falls to them.
 * The auto-assign engine only picks people who have weekly availability hours,
 * so team members are never auto-scheduled unless they opt in with hours.
 */
export const COMPANION_ROLES: UserRole[] = ["RUNNER", "STRATEGIST", "SUPER_ADMIN"];

export const companionWhere = { role: { in: COMPANION_ROLES }, isActive: true } as const;

export function isRunnerRole(role: UserRole | string) {
  return role === "RUNNER";
}

/** Sort runners first, then team, each alphabetically. */
export function sortCompanions<T extends { name: string; role: UserRole | string }>(users: T[]): T[] {
  return [...users].sort((a, b) => {
    const ra = isRunnerRole(a.role) ? 0 : 1;
    const rb = isRunnerRole(b.role) ? 0 : 1;
    return ra - rb || a.name.localeCompare(b.name);
  });
}
