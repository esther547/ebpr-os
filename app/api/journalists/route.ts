import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageJournalists } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";
import { journalistWhere } from "./_shared";

// Optional text fields: trim, treat "" as absent
const optText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v ? v : undefined));

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  outlet: optText,
  beat: optText,
  phone: optText,
  city: optText,
  country: optText,
  language: optText,
  notes: z.string().trim().max(5000).optional().nullable().transform((v) => (v ? v : undefined)),
  tags: z
    .array(z.string().trim())
    .optional()
    .transform((arr) => Array.from(new Set((arr ?? []).filter(Boolean)))),
});

// Bulk import: validate rows individually so one bad row doesn't reject the whole file
const MAX_BULK_ROWS = 10_000;
const CHUNK = 500;

export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageJournalists(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const search = sp.get("search") || "";
  const beat = sp.get("beat") || "";
  const tags = sp.getAll("tag").flatMap((t) => t.split(",")).map((t) => t.trim()).filter(Boolean);
  const countOnly = sp.get("count") === "1";

  const limitRaw = parseInt(sp.get("limit") || "100", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 100;
  const offsetRaw = parseInt(sp.get("offset") || "0", 10);
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

  const where = journalistWhere({ search, beat, tags });

  if (countOnly) {
    const total = await db.journalist.count({ where });
    return NextResponse.json({ total });
  }

  const [journalists, total] = await Promise.all([
    db.journalist.findMany({ where, orderBy: { name: "asc" }, take: limit, skip: offset }),
    db.journalist.count({ where }),
  ]);

  return NextResponse.json({ data: journalists, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageJournalists(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Bulk import (array of rows) ──────────────────────────
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    }
    if (body.length > MAX_BULK_ROWS) {
      return NextResponse.json(
        { error: `Too many rows in one request (max ${MAX_BULK_ROWS}). Split the file and try again.` },
        { status: 413 }
      );
    }

    const valid: z.infer<typeof createSchema>[] = [];
    const invalid: { row: number; reason: string }[] = [];
    const seen = new Set<string>();
    let duplicatesInFile = 0;

    body.forEach((raw, i) => {
      const parsed = createSchema.safeParse(raw);
      if (!parsed.success) {
        invalid.push({ row: i + 1, reason: parsed.error.issues[0]?.message ?? "Invalid row" });
        return;
      }
      if (seen.has(parsed.data.email)) {
        duplicatesInFile++;
        return;
      }
      seen.add(parsed.data.email);
      valid.push(parsed.data);
    });

    // createMany + skipDuplicates relies on the unique email index — no per-row lookups,
    // so a 5,000-row file is a handful of inserts instead of 10,000 queries.
    let created = 0;
    for (let i = 0; i < valid.length; i += CHUNK) {
      const chunk = valid.slice(i, i + CHUNK);
      const result = await db.journalist.createMany({
        data: chunk.map((j) => ({
          name: j.name,
          email: j.email,
          outlet: j.outlet,
          beat: j.beat,
          phone: j.phone,
          city: j.city,
          country: j.country,
          language: j.language,
          notes: j.notes,
          tags: j.tags,
        })),
        skipDuplicates: true,
      });
      created += result.count;
    }

    const alreadyExisted = valid.length - created;
    const skipped = alreadyExisted + duplicatesInFile;

    return NextResponse.json(
      {
        message: `Imported ${created}, skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}${
          invalid.length ? `, ${invalid.length} invalid row${invalid.length === 1 ? "" : "s"}` : ""
        }`,
        created,
        skipped,
        alreadyExisted,
        duplicatesInFile,
        invalid: invalid.slice(0, 50),
        invalidCount: invalid.length,
      },
      { status: 201 }
    );
  }

  // ── Single create ────────────────────────────────────────
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json(
      { error: first, fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await db.journalist.findFirst({
    where: { email: { equals: parsed.data.email, mode: "insensitive" } },
    select: { id: true, isActive: true, name: true },
  });
  if (existing) {
    if (!existing.isActive) {
      // Re-adding a previously removed contact: reactivate and update instead of failing
      const revived = await db.journalist.update({
        where: { id: existing.id },
        data: { ...parsed.data, isActive: true },
      });
      return NextResponse.json({ data: revived, reactivated: true }, { status: 200 });
    }
    return NextResponse.json(
      { error: `${existing.name} already exists with this email` },
      { status: 409 }
    );
  }

  const journalist = await db.journalist.create({ data: parsed.data });

  return NextResponse.json({ data: journalist }, { status: 201 });
}
