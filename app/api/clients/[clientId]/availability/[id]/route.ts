import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { noonUtc, toWindow } from "@/lib/client-availability";
import { availabilityPatchSchema, validateWindow, zodMessage } from "../_lib";

type Ctx = { params: Promise<{ clientId: string; id: string }> };

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

// PATCH — edit a window (partial; cross-field rules are checked on the merged result).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { clientId, id } = await params;

  const existing = await db.clientAvailability.findFirst({ where: { id, clientId } });
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = availabilityPatchSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  const current = toWindow(existing);
  const merged = {
    kind: d.kind ?? current.kind,
    startDate: d.startDate ?? current.startKey,
    endDate: d.endDate ?? current.endKey,
    location: d.location !== undefined ? d.location : current.location,
    notes: d.notes !== undefined ? d.notes : current.notes,
  };
  const invalid = validateWindow(merged);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const row = await db.clientAvailability.update({
    where: { id },
    data: {
      kind: merged.kind,
      startDate: noonUtc(merged.startDate),
      endDate: noonUtc(merged.endDate),
      location: merged.location ?? null,
      notes: merged.notes ?? null,
    },
  });
  return NextResponse.json({ data: toWindow(row) });
}

// DELETE — remove a window.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { clientId, id } = await params;

  const existing = await db.clientAvailability.findFirst({ where: { id, clientId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  await db.clientAvailability.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
