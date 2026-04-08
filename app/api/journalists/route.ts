import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageJournalists } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  outlet: z.string().optional(),
  beat: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  language: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Bulk import schema
const bulkSchema = z.array(createSchema);

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!canManageJournalists(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = req.nextUrl.searchParams.get("search") || "";
  const beat = req.nextUrl.searchParams.get("beat") || "";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100");

  const where: any = { isActive: true };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { outlet: { contains: search, mode: "insensitive" } },
    ];
  }
  if (beat) {
    where.beat = { contains: beat, mode: "insensitive" };
  }

  const journalists = await db.journalist.findMany({
    where,
    orderBy: { name: "asc" },
    take: limit,
  });

  const total = await db.journalist.count({ where: { isActive: true } });

  return NextResponse.json({ data: journalists, total });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!canManageJournalists(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  // Check if it's a bulk import (array) or single create
  if (Array.isArray(body)) {
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    for (const j of parsed.data) {
      const existing = await db.journalist.findUnique({ where: { email: j.email } });
      if (existing) { skipped++; continue; }
      await db.journalist.create({
        data: {
          name: j.name,
          email: j.email,
          outlet: j.outlet,
          beat: j.beat,
          phone: j.phone,
          city: j.city,
          country: j.country,
          language: j.language,
          notes: j.notes,
          tags: j.tags || [],
        },
      });
      created++;
    }

    return NextResponse.json({ message: `Imported ${created}, skipped ${skipped} duplicates` }, { status: 201 });
  }

  // Single create
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await db.journalist.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Journalist with this email already exists" }, { status: 409 });
  }

  const journalist = await db.journalist.create({
    data: { ...parsed.data, tags: parsed.data.tags || [] },
  });

  return NextResponse.json({ data: journalist }, { status: 201 });
}
