import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTasks } from "@/lib/permissions";
import { noteSelect, toNoteDTO } from "@/lib/client-notes";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(50_000).optional(),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

async function own(clientId: string, noteId: string) {
  let user;
  try { user = await requireUser(); } catch { return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const; }
  if (!canManageTasks(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  const note = await db.clientNote.findFirst({ where: { id: noteId, clientId }, select: { id: true } });
  if (!note) return { error: NextResponse.json({ error: "Nota no encontrada" }, { status: 404 }) } as const;
  return { user, note } as const;
}

export async function PATCH(req: NextRequest, { params }: { params: { clientId: string; noteId: string } }) {
  const o = await own(params.clientId, params.noteId);
  if ("error" in o) return o.error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const note = await db.clientNote.update({
    where: { id: o.note.id },
    data: { ...(d.title !== undefined ? { title: d.title } : {}), ...(d.body !== undefined ? { body: d.body } : {}), ...(d.meetingDate !== undefined ? { meetingDate: d.meetingDate ? new Date(`${d.meetingDate}T12:00:00.000Z`) : null } : {}) },
    select: noteSelect,
  });
  return NextResponse.json({ data: toNoteDTO(note) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { clientId: string; noteId: string } }) {
  const o = await own(params.clientId, params.noteId);
  if ("error" in o) return o.error;
  await db.clientNote.delete({ where: { id: o.note.id } });
  return NextResponse.json({ data: { id: o.note.id } });
}
