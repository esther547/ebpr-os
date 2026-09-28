/**
 * A goal is CLOSED ("cerrada") the moment it is confirmed/secured — it counts toward the
 * client's month right then and is then followed up until it is executed (COMPLETED).
 * (Esther, Sept 28 2026.) Progress counters use this, not COMPLETED alone.
 */
export const CLOSED_GOAL_STATUSES = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;
export type ClosedGoalStatus = (typeof CLOSED_GOAL_STATUSES)[number];
export const isClosedGoal = (status: string): status is ClosedGoalStatus =>
  (CLOSED_GOAL_STATUSES as readonly string[]).includes(status);
/** Still being worked (pitched / idea): not yet closed. */
export const isOpenGoal = (status: string) => status === "IDEA" || status === "OUTREACH";
