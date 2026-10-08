import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageOutreach } from "@/lib/permissions";
import { sendOutreach, type Flyer } from "@/lib/outreach";

const schema = z.object({
  list: z.string().trim().min(1).max(100).optional(),
  subject: z.string().trim().min(1, "Escribe un asunto").max(200),
  body: z.string().trim().min(1, "Escribe el mensaje").max(20_000),
  categories: z.array(z.string().trim()).optional().default([]),
  tags: z.array(z.string().trim()).optional().default([]),
  test: z.boolean().optional().default(false),
  /** Sender name the guest sees, header text and footer line (defaults: EB Public Relations). */
  fromName: z.string().trim().max(120).optional(),
  header: z.string().trim().max(120).optional(),
  footer: z.string().trim().max(300).optional(),
  /** Direct send to these addresses only (with optional cc) instead of the database. */
  to: z.array(z.string().trim().toLowerCase().email()).max(20).optional(),
  cc: z.array(z.string().trim().toLowerCase().email()).max(20).optional(),
  excludeTags: z.array(z.string().trim()).optional().default([]),
  /** Also send to every active journalist (the Medios database). */
  includeMedios: z.boolean().optional().default(false),
});

/** POST: send an invitation to the matching contacts, or (test=true) only to the signed-in sender. */
export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageOutreach(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let raw: unknown; let flyer: Flyer | null = null;
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
    const str = (k: string) => String(form.get(k) ?? "");
    raw = { list: str("list") || undefined, subject: str("subject"), body: str("body"), categories: str("categories").split(",").map((c) => c.trim()).filter(Boolean), tags: str("tags").split(",").map((t) => t.trim()).filter(Boolean), test: str("test") === "true", fromName: str("fromName") || undefined, header: form.has("header") ? str("header") : undefined, footer: form.has("footer") ? str("footer") : undefined, to: str("to").split(/[,;\s]+/).filter(Boolean), cc: str("cc").split(/[,;\s]+/).filter(Boolean), excludeTags: str("excludeTags").split(",").map((t) => t.trim()).filter(Boolean), includeMedios: str("includeMedios") === "true" };
    const file = form.get("flyer");
    if (file instanceof File && file.size > 0) {
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return NextResponse.json({ error: "El flyer debe ser una imagen (PNG, JPG, WebP o GIF)." }, { status: 400 });
      if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "El flyer pesa más de 5 MB." }, { status: 400 });
      flyer = { filename: file.name || "flyer.png", content: Buffer.from(await file.arrayBuffer()), contentType: file.type };
    }
  } else {
    raw = await req.json().catch(() => null);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const { list, subject, body, categories, tags, test, fromName, header, footer, to, cc, excludeTags, includeMedios } = parsed.data;
  const result = await sendOutreach({ list, subject, body, categories, tags, excludeTags, includeMedios, flyer, brand: { fromName, header, footer }, directTo: test ? undefined : to, cc: test ? undefined : cc, replyTo: user.email ?? undefined, testTo: test ? user.email ?? undefined : undefined, sentById: user.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
