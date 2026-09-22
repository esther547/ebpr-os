// Weekly priorities — shared server helpers (access check, week parsing, selects).
//
// The list lives per Miami week: `weekOf` is always Monday 00:00 in
// America/New_York, built with tzMidnight(weekStartKey(dayKey)) so the same row
// is found from a server running in UTC and from a browser in Miami.

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireUser, type SessionUser } from "@/lib/auth";
import {
  dayKeyInTz,
  tzMidnight,
  weekStartKey,
} from "@/components/runners/miami-time";

/** The Monday meeting list belongs to Esther and the strategists. */
export function canManagePriorities(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "STRATEGIST";
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day written as "yyyy-MM-dd" (rejects 2026-02-31). */
export function isValidDayKey(value: string): boolean {
  if (!DAY_KEY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Monday (Miami) of the week containing `dayKey`; the current week when omitted. */
export function resolveWeekKey(dayKey?: string | null): string {
  return weekStartKey(dayKey || dayKeyInTz(new Date()));
}

/** The instant a Miami week starts, i.e. the stored `weekOf` value. */
export function weekOfInstant(weekKey: string): Date {
  return tzMidnight(weekKey);
}

export const prioritySelect = {
  id: true,
  weekOf: true,
  clientId: true,
  title: true,
  notes: true,
  assigneeId: true,
  isDone: true,
  doneAt: true,
  order: true,
  client: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.WeeklyPrioritySelect;

/** Pending first, then the order the team gave them. */
export const priorityOrderBy = [
  { isDone: "asc" },
  { order: "asc" },
  { createdAt: "asc" },
] satisfies Prisma.WeeklyPriorityOrderByWithRelationInput[];

type Authorized =
  | { user: SessionUser; error?: undefined }
  | { user?: undefined; error: NextResponse };

/** 401 when signed out, 403 for every role that is not admin/strategist. */
export async function authorizePriorities(): Promise<Authorized> {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManagePriorities(user)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/** Parse a JSON body without ever turning a malformed one into a 500. */
export async function readJsonBody(req: Request): Promise<unknown | typeof INVALID_BODY> {
  try {
    return await req.json();
  } catch {
    return INVALID_BODY;
  }
}

export const INVALID_BODY = Symbol("invalid-body");

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** One readable line out of a zod failure. */
export function zodMessage(issues: { path: (string | number)[]; message: string }[]) {
  return issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
    .join("; ");
}

/** Comparison key used to detect an item that already exists in a week. */
export function dedupeKey(clientId: string | null, title: string): string {
  return `${clientId ?? ""}::${title.trim().toLowerCase()}`;
}
