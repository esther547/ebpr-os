import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canRunTimer, canViewTimesheet, timeEntrySelect, timesheetOwner, toDTO } from "@/lib/time-tracking";
import { addDaysKey, dayKeyInTz, formatInTz, tzMidnight, weekStartKey } from "@/components/runners/miami-time";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

async function auth() {
  try {
    const user = await requireUser();
    if (!canViewTimesheet(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
    const owner = await timesheetOwner();
    if (!owner) return { error: NextResponse.json({ error: "Usuario de Carolina no encontrado" }, { status: 404 }) } as const;
    return { user, owner } as const;
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
}

/** GET ?week=yyyy-MM-dd — the week's entries (+ the running timer). ?format=csv downloads them. */
export async function GET(req: NextRequest) {
  const a = await auth();
  if ("error" in a) return a.error;
  const sp = req.nextUrl.searchParams;
  const raw = sp.get("week");
  const week = weekStartKey(raw && DAY_KEY.test(raw) ? raw : dayKeyInTz(new Date()));
  const from = tzMidnight(week);
  const to = tzMidnight(addDaysKey(week, 7));
  const entries = await db.timeEntry.findMany({
    where: { userId: a.owner.id, OR: [{ startedAt: { gte: from, lt: to } }, { endedAt: null }] },
    select: timeEntrySelect,
    orderBy: { startedAt: "asc" },
  });

  if (sp.get("format") === "csv") {
    const now = Date.now();
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = ["Fecha,Inicio,Fin,Horas,Descripción"];
    let total = 0;
    for (const e of entries) {
      const end = e.endedAt ?? new Date(now);
      const hours = (end.getTime() - e.startedAt.getTime()) / 3_600_000;
      total += hours;
      lines.push([dayKeyInTz(e.startedAt), formatInTz(e.startedAt, { hour: "2-digit", minute: "2-digit", hour12: false }), e.endedAt ? formatInTz(e.endedAt, { hour: "2-digit", minute: "2-digit", hour12: false }) : "en curso", hours.toFixed(2), esc(e.description)].join(","));
    }
    lines.push(`Total,,,${total.toFixed(2)},`);
    return new NextResponse("\uFEFF" + lines.join("\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="horas-carolina-${week}.csv"` },
    });
  }
  return NextResponse.json({ data: { week, entries: entries.map(toDTO) } });
}

const startSchema = z.object({ description: z.string().trim().min(1, "Escribe en qué estás trabajando").max(300) });
const manualSchema = z.object({
  description: z.string().trim().min(1, "Escribe una descripción").max(300),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
});

/** POST — start the timer ({description}) or add a manual entry ({description, startedAt, endedAt}). Carolina only. */
export async function POST(req: NextRequest) {
  const a = await auth();
  if ("error" in a) return a.error;
  if (!canRunTimer(a.user)) return NextResponse.json({ error: "Solo Carolina registra sus horas" }, { status: 403 });
  const body = await req.json().catch(() => null);

  if (body && body.startedAt) {
    const parsed = manualSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    const startedAt = new Date(parsed.data.startedAt);
    const endedAt = new Date(parsed.data.endedAt);
    if (endedAt <= startedAt) return NextResponse.json({ error: "La hora de fin debe ser después del inicio" }, { status: 400 });
    if (endedAt.getTime() - startedAt.getTime() > 24 * 3_600_000) return NextResponse.json({ error: "Una entrada no puede pasar de 24 horas" }, { status: 400 });
    const e = await db.timeEntry.create({ data: { userId: a.user.id, description: parsed.data.description, startedAt, endedAt }, select: timeEntrySelect });
    return NextResponse.json({ data: toDTO(e) }, { status: 201 });
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const now = new Date();
  // Starting a new timer stops the one that is running (like Clockify).
  await db.timeEntry.updateMany({ where: { userId: a.user.id, endedAt: null }, data: { endedAt: now } });
  const e = await db.timeEntry.create({ data: { userId: a.user.id, description: parsed.data.description, startedAt: now }, select: timeEntrySelect });
  return NextResponse.json({ data: toDTO(e) }, { status: 201 });
}
