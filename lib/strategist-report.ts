/**
 * "Metas por estratega": goals (deliverables) closed per strategist in a Miami week or month.
 * Shared by the report page (/reports/strategists) and its CSV export.
 *
 * A goal counts in a range when it is COMPLETED and its completedAt falls inside the range;
 * it is credited to Deliverable.closedById (the strategist who closed it).
 */
import type { DeliverableType, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { addDaysKey, dayKeyInTz, tzMidnight, weekStartKey } from "@/components/runners/miami-time";

export const STRATEGIST_ROLES: UserRole[] = ["SUPER_ADMIN", "STRATEGIST"];

export const TYPE_LABELS_ES: Record<DeliverableType, string> = {
  PRESS_PLACEMENT: "Prensa",
  INTERVIEW: "Entrevista",
  INFLUENCER_COLLAB: "Influencer",
  EVENT_APPEARANCE: "Evento",
  BRAND_OPPORTUNITY: "Marca",
  INTRODUCTION: "Introducción",
  SOCIAL_MEDIA: "Redes sociales",
  PRESS_RELEASE: "Comunicado",
  OTHER: "Otro",
};

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_RE = /^(\d{4})-(\d{2})$/;

export function isValidDayKey(value: string | null | undefined): value is string {
  if (!value || !DAY_KEY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export type ReportRange = {
  mode: "week" | "month";
  /** First day, "yyyy-MM-dd" (Miami). */
  fromKey: string;
  /** Last day, inclusive, "yyyy-MM-dd" (Miami). */
  toKey: string;
  /** Week start ("yyyy-MM-dd") or month ("yyyy-MM"): the value used in the URL. */
  paramValue: string;
  label: string;
  prevParam: string;
  nextParam: string;
  isCurrent: boolean;
};

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** "Semana del 21 al 27 de septiembre". */
export function weekLabelEs(weekKey: string): string {
  const endKey = addDaysKey(weekKey, 6);
  const [sy, sm, sd] = weekKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  if (sy === ey && sm === em) return `Semana del ${sd} al ${ed} de ${MONTHS_ES[sm - 1]}`;
  if (sy === ey) return `Semana del ${sd} de ${MONTHS_ES[sm - 1]} al ${ed} de ${MONTHS_ES[em - 1]}`;
  return `Semana del ${sd} de ${MONTHS_ES[sm - 1]} de ${sy} al ${ed} de ${MONTHS_ES[em - 1]} de ${ey}`;
}

export function monthLabelEs(year: number, month: number): string {
  const name = MONTHS_ES[month - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

/** Resolve ?week=yyyy-MM-dd (default: current Miami week) or ?month=yyyy-MM. */
export function resolveRange(params: { week?: string; month?: string }, now = new Date()): ReportRange {
  const todayKey = dayKeyInTz(now);
  const m = params.month ? MONTH_KEY_RE.exec(params.month) : null;
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const next = shiftMonth(year, month, 1);
    const prev = shiftMonth(year, month, -1);
    const fromKey = `${monthKey(year, month)}-01`;
    const toKey = addDaysKey(`${monthKey(next.year, next.month)}-01`, -1);
    return {
      mode: "month",
      fromKey,
      toKey,
      paramValue: monthKey(year, month),
      label: monthLabelEs(year, month),
      prevParam: monthKey(prev.year, prev.month),
      nextParam: monthKey(next.year, next.month),
      isCurrent: todayKey.slice(0, 7) === monthKey(year, month),
    };
  }

  const currentWeek = weekStartKey(todayKey);
  const weekKey = isValidDayKey(params.week) ? weekStartKey(params.week) : currentWeek;
  return {
    mode: "week",
    fromKey: weekKey,
    toKey: addDaysKey(weekKey, 6),
    paramValue: weekKey,
    label: weekLabelEs(weekKey),
    prevParam: addDaysKey(weekKey, -7),
    nextParam: addDaysKey(weekKey, 7),
    isCurrent: weekKey === currentWeek,
  };
}

/** Instants covering the inclusive Miami day-key range [fromKey, toKey]. */
export function rangeBounds(fromKey: string, toKey: string): { gte: Date; lt: Date } {
  return { gte: tzMidnight(fromKey), lt: tzMidnight(addDaysKey(toKey, 1)) };
}

export type ClosedGoal = {
  id: string;
  title: string;
  type: DeliverableType;
  completedAt: Date | null;
  client: { id: string; name: string };
  closedBy: { id: string; name: string } | null;
};

/** Every goal completed (completedAt) inside the inclusive Miami range, newest first. */
export async function loadClosedGoals(fromKey: string, toKey: string): Promise<ClosedGoal[]> {
  return db.deliverable.findMany({
    where: { status: "COMPLETED", completedAt: rangeBounds(fromKey, toKey) },
    select: {
      id: true,
      title: true,
      type: true,
      completedAt: true,
      client: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
    },
    orderBy: { completedAt: "desc" },
  });
}

/** Active SUPER_ADMIN + STRATEGIST users. */
export async function loadActiveStrategists() {
  return db.user.findMany({
    where: { isActive: true, role: { in: STRATEGIST_ROLES } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Up to two initials ("Paola Precilla" -> "PP"). */
export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
