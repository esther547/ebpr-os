import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageSocial, isReady, normalizeIdeas, socialSelect } from "@/lib/social-posts";

export const dynamic = "force-dynamic";

const ideaSchema = z.object({ text: z.string().max(1000), done: z.boolean().optional() });
const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  clientId: z.string().nullable().optional(),
  ideas: z.array(ideaSchema).max(3).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  /** true = mark as posted now; false = back to planning. */
  posted: z.boolean().optional(),
});

async function authorize() {
  try {
    const user = await requireUser();
    if (!canManageSocial(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { user };
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const data: Prisma.SocialPostUncheckedUpdateInput = {};
  if (d.title !== undefined) data.title = d.title;
  if (d.notes !== undefined) data.notes = d.notes || null;
  if (d.clientId !== undefined) {
    const clientId = d.clientId || null;
    if (clientId) {
      const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
    }
    data.clientId = clientId;
  }
  if (d.ideas !== undefined) data.ideas = normalizeIdeas(d.ideas);
  if (d.posted !== undefined) {
    if (d.posted) {
      const current = await db.socialPost.findUnique({ where: { id }, select: { ideas: true } });
      if (!current) return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });
      const ideas = d.ideas !== undefined ? normalizeIdeas(d.ideas) : normalizeIdeas(current.ideas);
      if (!isReady(ideas)) return NextResponse.json({ error: "Faltan ideas: un post se postea cuando sus 3 ideas están listas." }, { status: 400 });
      data.postedAt = new Date();
    } else {
      data.postedAt = null;
    }
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No hay nada que actualizar" }, { status: 400 });
  try {
    const post = await db.socialPost.update({ where: { id }, data, select: socialSelect });
    return NextResponse.json({ data: post });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });
    console.error("PATCH /api/social/[id]", err);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    await db.socialPost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });
    return NextResponse.json({ error: "No se pudo eliminar" }, { status: 500 });
  }
}
