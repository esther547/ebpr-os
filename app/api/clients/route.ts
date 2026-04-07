import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageClients, canViewClients } from "@/lib/permissions";
import { slugify } from "@/lib/utils";

const createClientSchema = z.object({
  name: z.string().min(1).max(100),
  industry: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  monthlyTarget: z.number().int().min(1).max(30).default(6),
});

export async function GET() {
  try {
    const user = await requireUser();
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
  } catch (err) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canManageClients(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, industry, website, monthlyTarget } = parsed.data;
    const slug = slugify(name);

    // Ensure unique slug
    const existing = await db.client.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "A client with this name already exists." },
        { status: 409 }
      );
    }

    const client = await db.client.create({
      data: { name, slug, industry, website: website || undefined, monthlyTarget },
    });

    // Log activity
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
