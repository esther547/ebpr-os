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

// ─── Boards ────────────────────────────────────────────────
// The same weekly list machinery powers three boards: the team's "Prioridades"
// and two personal to-do pages. Personal boards are locked by email, not role.

export type PriorityListKey = "TEAM" | "ESTHER" | "CAROLINA";

export type PriorityList = {
  key: PriorityListKey;
  /** URL of the board. */
  path: string;
  title: string;
  subtitle: string;
  /** Emails that may open the board (lowercase). Empty = role-based (team board). */
  viewers: string[];
  /** Personal boards have no assignees. */
  personal: boolean;
};

const ESTHER = "esther@ebmanagement.io";
const CAROLINA = "carolina@ebmanagement.io";

export const PRIORITY_LISTS: Record<PriorityListKey, PriorityList> = {
  TEAM: {
    key: "TEAM",
    path: "/priorities",
    title: "Prioridades de la semana",
    subtitle: "Lo que acordamos cerrar esta semana, por cliente.",
    viewers: [],
    personal: false,
  },
  ESTHER: {
    key: "ESTHER",
    path: "/todos/esther",
    title: "Esther to dos",
    subtitle: "Solo tú ves esta lista.",
    viewers: [ESTHER],
    personal: true,
  },
  CAROLINA: {
    key: "CAROLINA",
    path: "/todos/carolina",
    title: "Carolina's to dos",
    subtitle: "Solo Carolina y Esther ven esta lista.",
    viewers: [ESTHER, CAROLINA],
    personal: true,
  },
};

/** "esther" → ESTHER list; unknown slugs → null. */
export function priorityListFromSlug(slug: string): PriorityList | null {
  const key = slug.toUpperCase() as PriorityListKey;
  return key in PRIORITY_LISTS && key !== "TEAM" ? PRIORITY_LISTS[key] : null;
}

export function isPriorityListKey(value: unknown): value is PriorityListKey {
  return typeof value === "string" && value in PRIORITY_LISTS;
}

export function canAccessPriorityList(user: SessionUser, key: PriorityListKey): boolean {
  const list = PRIORITY_LISTS[key];
  if (!list.personal) return canManagePriorities(user);
  return list.viewers.includes((user.email ?? "").toLowerCase());
}

/** The personal boards this user may open (for the sidebar / landing redirect). */
export function personalListsFor(user: SessionUser): PriorityList[] {
  return Object.values(PRIORITY_LISTS).filter((l) => l.personal && canAccessPriorityList(user, l.key));
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
  list: true,
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

/** 401 when signed out, 403 when the user may not open that board (team board by default). */
export async function authorizePriorities(list: PriorityListKey = "TEAM"): Promise<Authorized> {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canAccessPriorityList(user, list)) {
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
