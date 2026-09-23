import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { noonUtc, toWindow } from "@/lib/client-availability";
import { availabilityCreateSchema, validateWindow, zodMessage } from "./_lib";

type Ctx = { params: Promise<{ clientId: string }> };

async function authorize() {
  try {
    const user = await requireUser();
    if (!canManageClients(user)) {
      return { error: NextResponse.json({ error: "No tienes permiso para esto" }, { status: 403 }) };
    }
    return { user };
  } catch {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
}

// GET — every availability window of the client, ordered by start date.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { clientId } = await params;

  const rows = await db.clientAvailability.findMany({
    where: { clientId },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json({ data: rows.map(toWindow) });
}

// POST — record a new OFF / TRAVEL window.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { clientId } = await params;

  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = availabilityCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  const invalid = validateWindow(d);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const row = await db.clientAvailability.create({
    data: {
      clientId,
      kind: d.kind,
      startDate: noonUtc(d.startDate),
      endDate: noonUtc(d.endDate),
      location: d.location ?? null,
      notes: d.notes ?? null,
      createdById: auth.user.id,
    },
  });
  return NextResponse.json({ data: toWindow(row) }, { status: 201 });
}
