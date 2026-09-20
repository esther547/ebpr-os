import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageJournalists } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

// Optional text fields: "" clears the value (null), absent leaves it untouched
const optText = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v ? v : null));

const updateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").optional(),
  outlet: optText,
  beat: optText,
  phone: optText,
  city: optText,
  country: optText,
  language: optText,
  notes: z
    .string()
    .trim()
    .max(5000)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? v : null)),
  tags: z
    .array(z.string().trim())
    .optional()
    .transform((arr) => (arr === undefined ? undefined : Array.from(new Set(arr.filter(Boolean))))),
  isActive: z.boolean().optional(),
});

type Params = { params: { id: string } };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageJournalists(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json(
      { error: first, fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await db.journalist.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!existing) return NextResponse.json({ error: "Journalist not found" }, { status: 404 });

  if (parsed.data.email && parsed.data.email !== existing.email) {
    const clash = await db.journalist.findFirst({
      where: { id: { not: id }, email: { equals: parsed.data.email, mode: "insensitive" } },
      select: { name: true },
    });
    if (clash) {
      return NextResponse.json({ error: `${clash.name} already uses this email` }, { status: 409 });
    }
  }

  const journalist = await db.journalist.update({ where: { id }, data: parsed.data });

  return NextResponse.json({ data: journalist });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageJournalists(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  const existing = await db.journalist.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Journalist not found" }, { status: 404 });

  await db.journalist.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ message: "Journalist removed from the active list" });
}
