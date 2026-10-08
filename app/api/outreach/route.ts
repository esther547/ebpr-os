import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageOutreach } from "@/lib/permissions";
import { db } from "@/lib/db";
import { DEFAULT_LIST, mediosEmails, outreachWhere } from "@/lib/outreach";

const optText = z.string().trim().max(500).optional().nullable().transform((v) => (v ? v : undefined));
const listField = z.string().trim().min(1).max(100).optional();
const contactSchema = z.object({
  list: listField,
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.string().trim().toLowerCase().optional().nullable().transform((v) => (v ? v : undefined)).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email inválido"),
  company: optText,
  role: optText,
  category: optText,
  phone: optText,
  city: optText,
  country: optText,
  notes: z.string().trim().max(5000).optional().nullable().transform((v) => (v ? v : undefined)),
  tags: z.array(z.string().trim()).optional().transform((arr) => Array.from(new Set((arr ?? []).filter(Boolean)))),
}).refine((c) => !!c.email || !!c.phone, { message: "Pon un email o un teléfono", path: ["email"] });
const bulkSchema = z.object({ list: listField, rows: z.array(z.unknown()).max(10_000) });

export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageOutreach(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const where = outreachWhere({
    list: sp.get("list") || DEFAULT_LIST,
    search: sp.get("search"),
    withEmail: sp.get("withEmail") === "1",
    category: sp.get("category"),
    categories: sp.getAll("categories").flatMap((c) => c.split(",")),
    tags: sp.getAll("tag").flatMap((t) => t.split(",")),
    excludeTags: sp.getAll("excludeTags").flatMap((t) => t.split(",")),
  });
  if (sp.get("count") === "1") {
    const total = await db.outreachContact.count({ where });
    const medios = sp.get("includeMedios") === "1" ? (await mediosEmails()).length : 0;
    return NextResponse.json({ total: total + medios, contacts: total, medios });
  }
  const limit = Math.min(Math.max(parseInt(sp.get("limit") || "100", 10) || 100, 1), 1000);
  const offset = Math.max(parseInt(sp.get("offset") || "0", 10) || 0, 0);
  const [data, total] = await Promise.all([
    db.outreachContact.findMany({ where, orderBy: { name: "asc" }, take: limit, skip: offset }),
    db.outreachContact.count({ where }),
  ]);
  return NextResponse.json({ data, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageOutreach(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (body === null) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  // Bulk import: { rows: [...] } — each row validated on its own; duplicates (by email) are updated.
  if (body && typeof body === "object" && Array.isArray((body as { rows?: unknown }).rows)) {
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Filas inválidas" }, { status: 400 });
    const list = parsed.data.list ?? DEFAULT_LIST;
    let created = 0, updated = 0; const errors: string[] = [];
    for (const [i, raw] of parsed.data.rows.entries()) {
      const r = contactSchema.safeParse(raw);
      if (!r.success) { errors.push(`Fila ${i + 1}: ${r.error.issues[0]?.message ?? "inválida"}`); continue; }
      const existing = r.data.email ? await db.outreachContact.findUnique({ where: { email: r.data.email }, select: { id: true, tags: true } }) : null;
      if (existing) {
        await db.outreachContact.update({ where: { id: existing.id }, data: { ...r.data, list, tags: Array.from(new Set([...existing.tags, ...r.data.tags])), isActive: true } });
        updated++;
      } else {
        await db.outreachContact.create({ data: { ...r.data, list, source: "Importado desde el portal" } });
        created++;
      }
    }
    return NextResponse.json({ created, updated, errors: errors.slice(0, 20), errorCount: errors.length });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const clash = parsed.data.email ? await db.outreachContact.findUnique({ where: { email: parsed.data.email }, select: { name: true } }) : null;
  if (clash) return NextResponse.json({ error: `${clash.name} ya usa este email` }, { status: 409 });
  const contact = await db.outreachContact.create({ data: { ...parsed.data, list: parsed.data.list ?? DEFAULT_LIST, source: "Agregado en el portal" } });
  return NextResponse.json(contact, { status: 201 });
}
