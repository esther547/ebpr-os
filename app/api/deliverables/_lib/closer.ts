import { db } from "@/lib/db";
import type { UserRole } from "@prisma/client";

/** Roles that can be recorded as the strategist who closed a goal. */
export const CLOSER_ROLES: UserRole[] = ["SUPER_ADMIN", "STRATEGIST"];

export type Closer = { id: string; name: string };

/**
 * Who closed a goal (status -> COMPLETED). Precedence:
 *   1. the explicitly chosen strategist (must be an active SUPER_ADMIN / STRATEGIST),
 *   2. the current user, when they are a SUPER_ADMIN / STRATEGIST,
 *   3. the deliverable's assignee (e.g. a runner completing the linked pauta).
 * Returns `{ error }` when an explicit choice is not a valid strategist.
 */
export async function resolveCloser(opts: {
  requestedId?: string | null;
  currentUser: { id: string; name: string; role: UserRole };
  assigneeId?: string | null;
}): Promise<{ closer: Closer | null; error?: undefined } | { closer?: undefined; error: string }> {
  const { requestedId, currentUser, assigneeId } = opts;

  if (requestedId) {
    const chosen = await db.user.findFirst({
      where: { id: requestedId, isActive: true, role: { in: CLOSER_ROLES } },
      select: { id: true, name: true },
    });
    if (!chosen) return { error: "closedById must be an active strategist (SUPER_ADMIN or STRATEGIST)" };
    return { closer: chosen };
  }

  if (CLOSER_ROLES.includes(currentUser.role)) {
    return { closer: { id: currentUser.id, name: currentUser.name } };
  }

  if (assigneeId) {
    const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { id: true, name: true } });
    if (assignee) return { closer: assignee };
  }
  return { closer: null };
}
