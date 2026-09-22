import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  INVALID_BODY,
  authorizePriorities,
  badRequest,
  prioritySelect,
  readJsonBody,
  zodMessage,
} from "@/lib/priorities";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(300).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  isDone: z.boolean().optional(),
  clientId: z.string().nullable().optional(),
  order: z.number().int().min(0).max(100_000).optional(),
});

/** PATCH /api/priorities/[id] — edit, check off, reassign or move one line. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizePriorities();
  if (auth.error) return auth.error;

  const { id } = await params;

  const body = await readJsonBody(req);
  if (body === INVALID_BODY) return badRequest("El cuerpo de la petición no es JSON válido");

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: zodMessage(parsed.error.issues), details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return badRequest("No hay nada que actualizar");
  }

  const existing = await db.weeklyPriority.findUnique({
    where: { id },
    select: { id: true, weekOf: true, clientId: true },
  });
  if (!existing) return NextResponse.json({ error: "Prioridad no encontrada" }, { status: 404 });

  const d = parsed.data;
  const data: Prisma.WeeklyPriorityUncheckedUpdateInput = {};

  if (d.title !== undefined) data.title = d.title;
  if (d.notes !== undefined) data.notes = d.notes || null;
  if (d.order !== undefined) data.order = d.order;

  if (d.assigneeId !== undefined) {
    const assigneeId = d.assigneeId || null;
    if (assigneeId) {
      const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { id: true } });
      if (!assignee) return badRequest("Responsable no encontrado");
    }
    data.assigneeId = assigneeId;
  }

  if (d.isDone !== undefined) {
    data.isDone = d.isDone;
    data.doneAt = d.isDone ? new Date() : null;
  }

  if (d.clientId !== undefined) {
    const clientId = d.clientId || null;
    if (clientId) {
      const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) return badRequest("Cliente no encontrado");
    }
    data.clientId = clientId;
    // Moving to another list puts the item at the bottom of that list.
    if (clientId !== existing.clientId && d.order === undefined) {
      const last = await db.weeklyPriority.aggregate({
        where: { weekOf: existing.weekOf, clientId },
        _max: { order: true },
      });
      data.order = (last._max.order ?? -1) + 1;
    }
  }

  try {
    const item = await db.weeklyPriority.update({ where: { id }, data, select: prioritySelect });
    return NextResponse.json({ data: item });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Prioridad no encontrada" }, { status: 404 });
    }
    console.error("PATCH /api/priorities/[id] failed:", err);
    return NextResponse.json({ error: "No se pudo actualizar la prioridad" }, { status: 500 });
  }
}

/** DELETE /api/priorities/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizePriorities();
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    await db.weeklyPriority.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Prioridad no encontrada" }, { status: 404 });
    }
    console.error("DELETE /api/priorities/[id] failed:", err);
    return NextResponse.json({ error: "No se pudo eliminar la prioridad" }, { status: 500 });
  }
}
