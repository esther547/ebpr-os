import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManagePressReleases, canRequestPressRelease } from "@/lib/permissions";
import { notifyWritersOfRequest, requestSelect } from "@/lib/press-release-requests";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  clientId: z.string().min(1, "Elige el cliente"),
  news: z.string().trim().min(1, "Escribe la noticia").max(4000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser yyyy-MM-dd"),
  photosUrl: z.string().trim().max(1000).nullable().optional(),
  info: z.string().trim().max(4000).nullable().optional(),
});

/** GET — every request (writer, strategists, admin). */
export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!canManagePressReleases(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await db.pressReleaseRequest.findMany({ select: requestSelect, orderBy: [{ status: "asc" }, { dueDate: "asc" }] });
  return NextResponse.json({ data });
}

/** POST — a strategist asks the writer for a press release. */
export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!canRequestPressRelease(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const client = await db.client.findUnique({ where: { id: parsed.data.clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 400 });
  const created = await db.pressReleaseRequest.create({
    data: {
      clientId: parsed.data.clientId,
      news: parsed.data.news,
      dueDate: new Date(`${parsed.data.dueDate}T12:00:00Z`),
      photosUrl: parsed.data.photosUrl || null,
      info: parsed.data.info || null,
      requestedById: user.id,
    },
    select: requestSelect,
  });
  const notify = await notifyWritersOfRequest(created.id).catch(() => ({ notified: 0, emailed: false }));
  return NextResponse.json({ data: created, notify }, { status: 201 });
}
