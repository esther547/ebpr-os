import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { PRIORITY_LISTS, authorizePriorities, isPriorityListKey } from "@/lib/priorities";

export const dynamic = "force-dynamic";

const name = z.string().trim().min(1, "Ponle un nombre").max(40, "Máximo 40 caracteres");
const createSchema = z.object({ list: z.string(), name });
const renameSchema = z.object({ id: z.string().min(1), name });
const deleteSchema = z.object({ id: z.string().min(1) });

/** Only boards grouped by category (Esther to dos) take custom sections. */
function boardOf(list: string) {
  return isPriorityListKey(list) && PRIORITY_LISTS[list].categories ? PRIORITY_LISTS[list] : null;
}
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** POST — add a section ("cliente") to a category board. */
export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const board = boardOf(parsed.data.list);
  if (!board) return NextResponse.json({ error: "Este tablero no admite secciones" }, { status: 400 });
  const auth = await authorizePriorities(board.key);
  if (auth.error) return auth.error;
  const existing = await db.priorityCategory.findMany({ where: { list: board.key }, select: { name: true, sortOrder: true } });
  if ([...(board.categories ?? []), ...existing.map((e) => e.name)].some((n) => sameName(n, parsed.data.name))) return NextResponse.json({ error: "Ya existe una sección con ese nombre" }, { status: 409 });
  const row = await db.priorityCategory.create({ data: { list: board.key, name: parsed.data.name, sortOrder: Math.max(0, ...existing.map((e) => e.sortOrder)) + 1 } });
  return NextResponse.json({ data: row }, { status: 201 });
}

/** PATCH — rename a custom section; its to-dos (every week) follow the new name. */
export async function PATCH(req: NextRequest) {
  const parsed = renameSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const cur = await db.priorityCategory.findUnique({ where: { id: parsed.data.id } });
  const board = cur ? boardOf(cur.list) : null;
  if (!cur || !board) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const auth = await authorizePriorities(board.key);
  if (auth.error) return auth.error;
  const others = await db.priorityCategory.findMany({ where: { list: cur.list, id: { not: cur.id } }, select: { name: true } });
  if ([...(board.categories ?? []), ...others.map((e) => e.name)].some((n) => sameName(n, parsed.data.name))) return NextResponse.json({ error: "Ya existe una sección con ese nombre" }, { status: 409 });
  const [row] = await db.$transaction([
    db.priorityCategory.update({ where: { id: cur.id }, data: { name: parsed.data.name } }),
    db.weeklyPriority.updateMany({ where: { list: cur.list, category: cur.name }, data: { category: parsed.data.name } }),
  ]);
  return NextResponse.json({ data: row });
}

/** DELETE — remove a custom section. Its to-dos are never deleted: they go to "Sin categoría". */
export async function DELETE(req: NextRequest) {
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const cur = await db.priorityCategory.findUnique({ where: { id: parsed.data.id } });
  const board = cur ? boardOf(cur.list) : null;
  if (!cur || !board) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const auth = await authorizePriorities(board.key);
  if (auth.error) return auth.error;
  const [, moved] = await db.$transaction([
    db.priorityCategory.delete({ where: { id: cur.id } }),
    db.weeklyPriority.updateMany({ where: { list: cur.list, category: cur.name }, data: { category: null } }),
  ]);
  return NextResponse.json({ data: { id: cur.id, moved: moved.count } });
}
