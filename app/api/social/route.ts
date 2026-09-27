import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageSocial, normalizeIdeas, socialSelect } from "@/lib/social-posts";

export const dynamic = "force-dynamic";

const ideaSchema = z.object({ text: z.string().max(1000), done: z.boolean().optional() });
const createSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  clientId: z.string().min(1).nullable().optional(),
  ideas: z.array(ideaSchema).max(3).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
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

/** GET /api/social — every post, pending first. */
export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const posts = await db.socialPost.findMany({ select: socialSelect, orderBy: [{ postedAt: "asc" }, { order: "asc" }, { createdAt: "desc" }] });
  return NextResponse.json({ data: posts });
}

/** POST /api/social — new post with its (up to 3) ideas. */
export async function POST(req: NextRequest) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const clientId = parsed.data.clientId ?? null;
  if (clientId) {
    const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
  }
  const last = await db.socialPost.aggregate({ _max: { order: true } });
  const post = await db.socialPost.create({
    data: {
      title: parsed.data.title,
      clientId,
      ideas: normalizeIdeas(parsed.data.ideas),
      notes: parsed.data.notes || null,
      order: (last._max.order ?? -1) + 1,
      createdById: auth.user.id,
    },
    select: socialSelect,
  });
  return NextResponse.json({ data: post }, { status: 201 });
}
