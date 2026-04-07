import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { StrategyCategory, StrategyStatus } from "@prisma/client";

const itemSchema = z.object({
  title: z.string().min(1),
  category: z.enum([
    "MEDIA_TARGET",
    "BRAND_OPPORTUNITY",
    "EVENT",
    "INFLUENCER",
    "POSITIONING",
    "OTHER",
  ]),
  status: z
    .enum(["IDEA", "APPROVED", "IN_PROGRESS", "COMPLETED", "REJECTED", "ON_HOLD"])
    .optional()
    .default("IDEA"),
  targetName: z.string().optional(),
  brandCategory: z.string().optional(),
  episodeNumber: z.number().int().optional(),
  scheduledDate: z.string().datetime().optional().nullable(),
  eventLocation: z.string().optional(),
  phase: z.number().int().min(1).max(2).optional().nullable(),
  isBigWin: z.boolean().optional().default(false),
  notes: z.string().optional(),
  priority: z.number().int().min(0).max(3).optional().default(0),
});

const bulkSchema = z.object({
  items: z.array(itemSchema).min(1).max(500),
  replaceCategory: z.boolean().optional().default(false),
});

// POST — bulk create/replace strategy items
export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  await requireUser();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { items, replaceCategory } = parsed.data;

  // If replaceCategory is true, delete existing items for the given categories first
  if (replaceCategory) {
    const categories = [...new Set(items.map((i) => i.category))] as StrategyCategory[];
    await db.strategyItem.deleteMany({
      where: {
        clientId: params.clientId,
        category: { in: categories },
      },
    });
  }

  // Bulk create
  const created = await db.$transaction(
    items.map((item) =>
      db.strategyItem.create({
        data: {
          clientId: params.clientId,
          title: item.title,
          category: item.category as StrategyCategory,
          status: item.status as StrategyStatus,
          targetName: item.targetName,
          brandCategory: item.brandCategory,
          episodeNumber: item.episodeNumber,
          scheduledDate: item.scheduledDate ? new Date(item.scheduledDate) : null,
          eventLocation: item.eventLocation,
          phase: item.phase ?? null,
          isBigWin: item.isBigWin,
          notes: item.notes,
          priority: item.priority,
        },
      })
    )
  );

  return NextResponse.json(
    { data: created, count: created.length },
    { status: 201 }
  );
}

// DELETE — delete all strategy items for one or more categories
export async function DELETE(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  await requireUser();

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const where = category
    ? { clientId: params.clientId, category: category as StrategyCategory }
    : { clientId: params.clientId };

  const { count } = await db.strategyItem.deleteMany({ where });

  return NextResponse.json({ success: true, deleted: count });
}
