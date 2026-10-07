import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageOutreach } from "@/lib/permissions";
import { sendOutreach } from "@/lib/outreach";

const schema = z.object({
  list: z.string().trim().min(1).max(100).optional(),
  subject: z.string().trim().min(1, "Escribe un asunto").max(200),
  body: z.string().trim().min(1, "Escribe el mensaje").max(20_000),
  categories: z.array(z.string().trim()).optional().default([]),
  tags: z.array(z.string().trim()).optional().default([]),
  test: z.boolean().optional().default(false),
});

/** POST: send an invitation to the matching contacts, or (test=true) only to the signed-in sender. */
export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageOutreach(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const { list, subject, body, categories, tags, test } = parsed.data;
  const result = await sendOutreach({ list, subject, body, categories, tags, replyTo: user.email ?? undefined, testTo: test ? user.email ?? undefined : undefined, sentById: user.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
