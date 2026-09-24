// Industry events calendar — server logic (occurrences, upcoming list, the
// daily reminder run, and the "Trabajar oportunidad" weekly priority).
//
// Every date decision is made on Miami calendar days (see miami-time.ts);
// occurrence dates are stored/compared at 12:00 UTC of that day.

import { NextResponse } from "next/server";
import { z } from "zod";
import type { IndustryEvent } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import {
  dayKeyInTz,
  tzMidnight,
  weekStartKey,
} from "@/components/runners/miami-time";
import {
  DEFAULT_LEAD_DAYS,
  EVENT_CATEGORIES,
  approxDateLabel,
  daysBetweenKeys,
  daysInMonth,
  keyToNoonUtc,
  nextOccurrenceKey,
  opportunityPriorityTitle,
  shiftKey,
  type UpcomingEventItem,
} from "@/components/events/helpers";

type OccurrenceFields = Pick<IndustryEvent, "month" | "day" | "year">;

// ─── Occurrences ─────────────────────────────────────────

/**
 * The next occurrence of an event on or after `from` (Miami calendar day),
 * as 12:00 UTC of that day. Uses `year` when set (null once it is past);
 * otherwise this year's month/day (day ?? 1), or next year's if already past.
 */
export function nextOccurrence(event: OccurrenceFields, from: Date = new Date()): Date | null {
  const key = nextOccurrenceKey(event, dayKeyInTz(from));
  return key ? keyToNoonUtc(key) : null;
}

/**
 * Active events whose next occurrence falls within `days` days of today
 * (Miami), sorted by date — with the reminder day and whether that
 * occurrence has already been reminded.
 */
export async function upcomingEvents(days = 365, now: Date = new Date()): Promise<UpcomingEventItem[]> {
  const todayKey = dayKeyInTz(now);
  const horizonKey = shiftKey(todayKey, days);

  const events = await db.industryEvent.findMany({ where: { isActive: true } });
  const withDates = events
    .map((e) => ({ e, occursKey: nextOccurrenceKey(e, todayKey) }))
    .filter((x): x is { e: IndustryEvent; occursKey: string } => !!x.occursKey && x.occursKey <= horizonKey);

  const reminders = withDates.length
    ? await db.industryEventReminder.findMany({
        where: {
          OR: withDates.map(({ e, occursKey }) => ({ eventId: e.id, occursOn: keyToNoonUtc(occursKey) })),
        },
        select: { eventId: true, occursOn: true },
      })
    : [];
  const remindedSet = new Set(reminders.map((r) => `${r.eventId}|${r.occursOn.toISOString().slice(0, 10)}`));

  return withDates
    .map(({ e, occursKey }) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      month: e.month,
      day: e.day,
      year: e.year,
      city: e.city,
      notes: e.notes,
      url: e.url,
      leadDays: e.leadDays,
      occursKey,
      remindKey: shiftKey(occursKey, -e.leadDays),
      reminded: remindedSet.has(`${e.id}|${occursKey}`),
      daysUntil: daysBetweenKeys(todayKey, occursKey),
    }))
    .sort((a, b) => a.occursKey.localeCompare(b.occursKey) || a.name.localeCompare(b.name, "es"));
}

// ─── Weekly priority ─────────────────────────────────────

function priorityNotes(event: Pick<IndustryEvent, "city" | "notes" | "url" | "day">, occursKey: string): string {
  return [event.city, approxDateLabel(occursKey, event.day != null), event.notes, event.url]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Add the "Trabajar oportunidad: <name> (<mes>)" line to the General list of
 * the current Miami week, unless a line with that title is already there.
 */
export async function createOpportunityPriority(
  event: IndustryEvent,
  occursKey: string,
  createdById: string,
  now: Date = new Date()
): Promise<{ created: boolean; id: string }> {
  const weekOf = tzMidnight(weekStartKey(dayKeyInTz(now)));
  const title = opportunityPriorityTitle(event.name, occursKey);

  const existing = await db.weeklyPriority.findFirst({
    where: { weekOf, clientId: null, title: { equals: title, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return { created: false, id: existing.id };

  const last = await db.weeklyPriority.aggregate({
    where: { weekOf, clientId: null },
    _max: { order: true },
  });
  const row = await db.weeklyPriority.create({
    data: {
      weekOf,
      clientId: null,
      title,
      notes: priorityNotes(event, occursKey) || null,
      order: (last._max.order ?? -1) + 1,
      createdById,
    },
    select: { id: true },
  });
  return { created: true, id: row.id };
}

// ─── Daily reminder run (called from /api/cron) ──────────

export type EventReminderSummary = {
  checked: number;
  reminded: string[];
  errors?: string[];
};

/** "Oportunidad en ~2 meses: X" (or "3 semanas" / "10 días" when added late). */
function reminderTitle(name: string, daysUntil: number): string {
  if (daysUntil <= 0) return `Oportunidad hoy: ${name}`;
  const lead =
    daysUntil >= 45
      ? `~${Math.round(daysUntil / 30)} meses`
      : daysUntil >= 14
        ? `${Math.round(daysUntil / 7)} semanas`
        : daysUntil === 1
          ? "1 día"
          : `${daysUntil} días`;
  return `Oportunidad en ${lead}: ${name}`;
}

/**
 * Remind the team of every active event whose next occurrence is within its
 * lead time (occurrence − leadDays ≤ today, Miami) and that has not been
 * reminded for that occurrence yet:
 *  - one Notification per active SUPER_ADMIN / STRATEGIST,
 *  - one General WeeklyPriority for the current week (skipped if the title exists),
 *  - one IndustryEventReminder row, so the occurrence is never reminded twice.
 * The reminder row is claimed first (unique on eventId + occursOn), so two
 * overlapping runs cannot both notify; if the notify step fails, the claim is
 * released and tomorrow's run retries. Never throws.
 */
export async function runEventReminders(now: Date = new Date()): Promise<EventReminderSummary> {
  const summary: EventReminderSummary = { checked: 0, reminded: [] };
  const errors: string[] = [];

  try {
    const todayKey = dayKeyInTz(now);
    const events = await db.industryEvent.findMany({ where: { isActive: true } });
    summary.checked = events.length;

    const due = events
      .map((e) => ({ e, occursKey: nextOccurrenceKey(e, todayKey) }))
      .filter(
        (x): x is { e: IndustryEvent; occursKey: string } =>
          !!x.occursKey && shiftKey(x.occursKey, -x.e.leadDays) <= todayKey
      );
    if (due.length === 0) return summary;

    const [team, firstAdmin] = await Promise.all([
      db.user.findMany({
        where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } },
        select: { id: true },
      }),
      db.user.findFirst({
        where: { isActive: true, role: "SUPER_ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
    ]);

    for (const { e, occursKey } of due) {
      const occursOn = keyToNoonUtc(occursKey);

      // Already reminded for this occurrence? Claim it otherwise (the unique
      // key also stops a concurrent run that passed the check at the same time).
      const already = await db.industryEventReminder.findUnique({
        where: { eventId_occursOn: { eventId: e.id, occursOn } },
        select: { id: true },
      });
      if (already) continue;

      let claimId: string;
      try {
        const claim = await db.industryEventReminder.create({
          data: { eventId: e.id, occursOn, sentAt: now },
          select: { id: true },
        });
        claimId = claim.id;
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") continue; // already reminded
        errors.push(`${e.name}: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      try {
        const dateLabel = approxDateLabel(occursKey, e.day != null);
        const place = e.city ? ` · ${e.city}` : "";
        const title = reminderTitle(e.name, daysBetweenKeys(todayKey, occursKey));
        const message = `${e.name}${place} · ${dateLabel} ${occursKey.slice(0, 4)}. Es momento de trabajar la oportunidad para los clientes.`;

        if (team.length) {
          await db.notification.createMany({
            data: team.map((u) => ({
              userId: u.id,
              title,
              message,
              type: "industry_event",
              link: "/events",
            })),
          });
        }
        if (firstAdmin) {
          await createOpportunityPriority(e, occursKey, firstAdmin.id, now);
        }
        summary.reminded.push(e.name);
      } catch (err) {
        errors.push(`${e.name}: ${err instanceof Error ? err.message : String(err)}`);
        await db.industryEventReminder.delete({ where: { id: claimId } }).catch(() => {});
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  if (errors.length) summary.errors = errors;
  return summary;
}

// ─── API helpers ─────────────────────────────────────────

export function canManageEvents(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "STRATEGIST";
}

type Authorized =
  | { user: SessionUser; error?: undefined }
  | { user?: undefined; error: NextResponse };

/** 401 when signed out, 403 for every role that is not admin/strategist. */
export async function authorizeEvents(): Promise<Authorized> {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch {
    return { error: NextResponse.json({ error: "No has iniciado sesión" }, { status: 401 }) };
  }
  if (!canManageEvents(user)) {
    return { error: NextResponse.json({ error: "No tienes permiso para el calendario de eventos" }, { status: 403 }) };
  }
  return { user };
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const eventFields = {
  name: z
    .string({ required_error: "El nombre es obligatorio" })
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(200, "Máximo 200 caracteres"),
  category: z.enum(EVENT_CATEGORIES, { errorMap: () => ({ message: "Categoría no válida" }) }),
  month: z
    .number({ required_error: "El mes es obligatorio", invalid_type_error: "El mes debe ser un número" })
    .int("El mes debe ser un número entero")
    .min(1, "El mes debe estar entre 1 y 12")
    .max(12, "El mes debe estar entre 1 y 12"),
  day: z
    .number({ invalid_type_error: "El día debe ser un número" })
    .int("El día debe ser un número entero")
    .min(1, "El día debe estar entre 1 y 31")
    .max(31, "El día debe estar entre 1 y 31")
    .nullable()
    .optional(),
  year: z
    .number({ invalid_type_error: "El año debe ser un número" })
    .int("El año debe ser un número entero")
    .min(2000, "Año no válido")
    .max(2100, "Año no válido")
    .nullable()
    .optional(),
  city: optionalText(120),
  notes: optionalText(2000),
  url: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), "El link debe empezar con http:// o https://"),
  leadDays: z
    .number({ invalid_type_error: "Los días de anticipación deben ser un número" })
    .int("Los días de anticipación deben ser un número entero")
    .min(7, "Los días de anticipación deben estar entre 7 y 365")
    .max(365, "Los días de anticipación deben estar entre 7 y 365"),
  isActive: z.boolean({ invalid_type_error: "isActive debe ser true o false" }),
};

export const createEventSchema = z.object({
  ...eventFields,
  category: eventFields.category.optional().default("OTHER"),
  leadDays: eventFields.leadDays.optional().default(DEFAULT_LEAD_DAYS),
  isActive: eventFields.isActive.optional().default(true),
});

export const updateEventSchema = z.object({
  name: eventFields.name.optional(),
  category: eventFields.category.optional(),
  month: eventFields.month.optional(),
  day: eventFields.day,
  year: eventFields.year,
  city: eventFields.city,
  notes: eventFields.notes,
  url: eventFields.url,
  leadDays: eventFields.leadDays.optional(),
  isActive: eventFields.isActive.optional(),
});

/** Spanish error when a day does not exist in the month (e.g. 31 de abril). */
export function invalidDayMessage(month: number, day: number | null | undefined, year: number | null | undefined): string | null {
  if (day == null) return null;
  // Without a year, allow Feb 29 (clamped to Feb 28 in non-leap years).
  const max = daysInMonth(year ?? 2024, month);
  return day > max ? `Ese mes no tiene día ${day}` : null;
}

export function zodMessage(issues: { path: (string | number)[]; message: string }[]) {
  return issues.map((i) => i.message).join("; ");
}

export function eventErrorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export const eventSelect = {
  id: true,
  name: true,
  category: true,
  month: true,
  day: true,
  year: true,
  city: true,
  notes: true,
  url: true,
  leadDays: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;
