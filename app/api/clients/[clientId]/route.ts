import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageClients, canViewClients } from "@/lib/permissions";

const updateClientSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  industry: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  monthlyTarget: z.number().int().min(0).max(30).optional(),
  cycleDay: z.number().int().min(1).max(31).nullable().optional(),
  goalsOwed: z.number().int().min(0).max(999).optional(),
  focusNote: z.string().max(300).nullable().optional(),
  agendaDocUrl: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
  status: z.enum(["PROSPECT", "ACTIVE", "PAUSED", "CHURNED"]).optional(),
  description: z.string().nullable().optional(),
  strategyDocUrl: z.string().nullable().optional(),
});

function zodMessage(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
    .join("; ");
}

type Params = { params: { clientId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewClients(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    include: {
      contacts: true,
      contracts: { orderBy: { createdAt: "desc" } },
      onboarding: { include: { checklistItems: true } },
      campaigns: { orderBy: { createdAt: "desc" } },
      _count: {
        select: { deliverables: true, strategyItems: true, files: true },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: client });
}

export async function PUT(req: NextRequest, { params }: Params) {
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
    const parsed = updateClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error), details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.client.findUnique({
      where: { id: params.clientId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (parsed.data.strategyDocUrl && !/^https?:\/\//i.test(parsed.data.strategyDocUrl)) {
      return NextResponse.json({ error: "Strategy document link must be a full URL" }, { status: 400 });
    }

    const client = await db.client.update({
      where: { id: params.clientId },
      data: parsed.data,
    });

    const statusNote =
      parsed.data.status && parsed.data.status !== existing.status
        ? ` — status: ${parsed.data.status.toLowerCase()}`
        : "";

    await db.activityLog.create({
      data: {
        clientId: client.id,
        userId: user.id,
        action: "client_updated",
        description: `Updated client ${client.name}${statusNote}`,
      },
    });

    return NextResponse.json({ data: client });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("PUT /api/clients/[clientId] failed:", err);
    return NextResponse.json({ error: "Could not update client" }, { status: 500 });
  }
}
