import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageClients, canViewClients } from "@/lib/permissions";
import { slugify } from "@/lib/utils";

const createClientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  industry: z.string().optional(),
  website: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : undefined))
    .refine((v) => v === undefined || z.string().url().safeParse(v).success, {
      message: "Website must be a valid URL",
    }),
  monthlyTarget: z.number().int().min(1).max(30).default(6),
});

function zodMessage(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
    .join("; ");
}

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewClients(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clients = await db.client.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      onboarding: { select: { status: true } },
      _count: {
        select: { deliverables: true, campaigns: true, contracts: true },
      },
    },
  });

  return NextResponse.json({ data: clients });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageClients(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error), details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, industry, website, monthlyTarget } = parsed.data;

    // Same name (case-insensitive) is a real duplicate
    const sameName = await db.client.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (sameName) {
      return NextResponse.json(
        { error: "A client with this name already exists." },
        { status: 409 }
      );
    }

    // Different name but colliding slug (e.g. "Reykon!" vs "Reykon") -> suffix the slug
    const base = slugify(name) || "client";
    let slug = base;
    for (let i = 2; await db.client.findUnique({ where: { slug }, select: { id: true } }); i++) {
      slug = `${base}-${i}`;
    }

    const client = await db.client.create({
      data: { name, slug, industry: industry || undefined, website, monthlyTarget },
    });

    await db.activityLog.create({
      data: {
        clientId: client.id,
        userId: user.id,
        action: "client_created",
        description: `Created client ${client.name}`,
      },
    });

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (err) {
    console.error("POST /api/clients failed:", err);
    return NextResponse.json({ error: "Could not create client" }, { status: 500 });
  }
}
