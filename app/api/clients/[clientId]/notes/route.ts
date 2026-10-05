import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTasks } from "@/lib/permissions";
import { noteSelect, toNoteDTO } from "@/lib/client-notes";


const createSchema = z.object({
  title: z.string().trim().min(1, "Ponle un título a la nota").max(200),
  body: z.string().trim().min(1, "La nota está vacía").max(50_000),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

async function auth() {
  try {
    const user = await requireUser();
    if (!canManageTasks(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
    return { user } as const;
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const a = await auth();
  if ("error" in a) return a.error;
  const notes = await db.clientNote.findMany({ where: { clientId: params.clientId }, select: noteSelect, orderBy: [{ meetingDate: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ data: notes.map(toNoteDTO) });
}

/** POST — a new note (one per meeting or topic). */
export async function POST(req: NextRequest, { params }: { params: { clientId: string } }) {
  const a = await auth();
  if ("error" in a) return a.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const client = await db.client.findUnique({ where: { id: params.clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  const d = parsed.data;
  const note = await db.clientNote.create({
    data: { clientId: client.id, title: d.title, body: d.body, meetingDate: d.meetingDate ? new Date(`${d.meetingDate}T12:00:00.000Z`) : null, createdById: a.user.id },
    select: noteSelect,
  });
  return NextResponse.json({ data: toNoteDTO(note) }, { status: 201 });
}
