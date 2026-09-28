import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canRequestPressRelease, canSeePressRequests, canWorkPressReleaseRequests } from "@/lib/permissions";
import { notifyRequesterOfStatus, requestSelect } from "@/lib/press-release-requests";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  status: z.enum(["REQUESTED", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  draftUrl: z.string().trim().max(1000).nullable().optional(),
  writerNotes: z.string().trim().max(2000).nullable().optional(),
  news: z.string().trim().min(1).max(4000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  photosUrl: z.string().trim().max(1000).nullable().optional(),
  info: z.string().trim().max(4000).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!canSeePressRequests(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const data: Prisma.PressReleaseRequestUncheckedUpdateInput = {};
  // The writer (or Esther) works the request; strategists edit the brief or cancel it.
  const worker = canWorkPressReleaseRequests(user);
  const requester = canRequestPressRelease(user);
  if (d.status !== undefined) {
    if (!worker && !(requester && d.status === "CANCELLED")) return NextResponse.json({ error: "Solo el redactor cambia el estado" }, { status: 403 });
    data.status = d.status;
    data.doneAt = d.status === "DONE" ? new Date() : null;
  }
  if (d.draftUrl !== undefined || d.writerNotes !== undefined) {
    if (!worker) return NextResponse.json({ error: "Solo el redactor entrega el comunicado" }, { status: 403 });
    if (d.draftUrl !== undefined) data.draftUrl = d.draftUrl || null;
    if (d.writerNotes !== undefined) data.writerNotes = d.writerNotes || null;
  }
  if (d.news !== undefined || d.dueDate !== undefined || d.photosUrl !== undefined || d.info !== undefined) {
    if (!requester) return NextResponse.json({ error: "Solo los estrategas editan la solicitud" }, { status: 403 });
    if (d.news !== undefined) data.news = d.news;
    if (d.dueDate !== undefined) data.dueDate = new Date(`${d.dueDate}T12:00:00Z`);
    if (d.photosUrl !== undefined) data.photosUrl = d.photosUrl || null;
    if (d.info !== undefined) data.info = d.info || null;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No hay nada que actualizar" }, { status: 400 });
  try {
    const item = await db.pressReleaseRequest.update({ where: { id }, data, select: requestSelect });
    if (d.status !== undefined && worker) await notifyRequesterOfStatus(id).catch(() => undefined);
    return NextResponse.json({ data: item });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    console.error("PATCH press-release-requests", err);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!canRequestPressRelease(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    await db.pressReleaseRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }
}
