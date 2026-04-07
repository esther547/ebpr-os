import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const documentSchema = z.object({
  purpose: z.string().optional(),
  objective: z.string().optional(),
  strategicPath: z.string().optional(),
  messagingFramework: z.string().optional(),
  keyMessages: z.array(z.string()).optional(),
  clientPersona: z.string().optional(),
  targetAudience: z.string().optional(),
  executionNotes: z.string().optional(),
  servicesProvided: z.array(z.string()).optional(),
  phase1Name: z.string().optional(),
  phase1Start: z.string().datetime().optional().nullable(),
  phase1End: z.string().datetime().optional().nullable(),
  phase2Name: z.string().optional(),
  phase2Start: z.string().datetime().optional().nullable(),
  phase2End: z.string().datetime().optional().nullable(),
  externalCollaborators: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        organization: z.string().optional(),
      })
    )
    .optional(),
  prepMonthStart: z.string().datetime().optional().nullable(),
  prepMonthEnd: z.string().datetime().optional().nullable(),
  campaignStart: z.string().datetime().optional().nullable(),
  location: z.string().optional(),
  year: z.number().int().optional(),
});

// GET — fetch the strategy document for a client
export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  await requireUser();

  const doc = await db.strategyDocument.findUnique({
    where: { clientId: params.clientId },
  });

  if (!doc) {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  return NextResponse.json({ data: doc });
}

// POST — create strategy document
export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  await requireUser();

  const body = await req.json();
  const parsed = documentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Ensure client exists
  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const data = parsed.data;

  const doc = await db.strategyDocument.upsert({
    where: { clientId: params.clientId },
    create: {
      clientId: params.clientId,
      ...buildDocumentFields(data),
    },
    update: buildDocumentFields(data),
  });

  return NextResponse.json({ data: doc }, { status: 201 });
}

// PUT — update strategy document
export async function PUT(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  await requireUser();

  const body = await req.json();
  const parsed = documentSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await db.strategyDocument.findUnique({
    where: { clientId: params.clientId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Strategy document not found" }, { status: 404 });
  }

  const doc = await db.strategyDocument.update({
    where: { clientId: params.clientId },
    data: buildDocumentFields(parsed.data),
  });

  return NextResponse.json({ data: doc });
}

// DELETE — remove strategy document
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  await requireUser();

  await db.strategyDocument.delete({
    where: { clientId: params.clientId },
  });

  return NextResponse.json({ success: true });
}

function buildDocumentFields(data: z.infer<typeof documentSchema>) {
  return {
    ...(data.purpose !== undefined && { purpose: data.purpose }),
    ...(data.objective !== undefined && { objective: data.objective }),
    ...(data.strategicPath !== undefined && { strategicPath: data.strategicPath }),
    ...(data.messagingFramework !== undefined && { messagingFramework: data.messagingFramework }),
    ...(data.keyMessages !== undefined && { keyMessages: data.keyMessages }),
    ...(data.clientPersona !== undefined && { clientPersona: data.clientPersona }),
    ...(data.targetAudience !== undefined && { targetAudience: data.targetAudience }),
    ...(data.executionNotes !== undefined && { executionNotes: data.executionNotes }),
    ...(data.servicesProvided !== undefined && { servicesProvided: data.servicesProvided }),
    ...(data.phase1Name !== undefined && { phase1Name: data.phase1Name }),
    ...(data.phase1Start !== undefined && { phase1Start: data.phase1Start ? new Date(data.phase1Start) : null }),
    ...(data.phase1End !== undefined && { phase1End: data.phase1End ? new Date(data.phase1End) : null }),
    ...(data.phase2Name !== undefined && { phase2Name: data.phase2Name }),
    ...(data.phase2Start !== undefined && { phase2Start: data.phase2Start ? new Date(data.phase2Start) : null }),
    ...(data.phase2End !== undefined && { phase2End: data.phase2End ? new Date(data.phase2End) : null }),
    ...(data.externalCollaborators !== undefined && { externalCollaborators: data.externalCollaborators }),
    ...(data.prepMonthStart !== undefined && { prepMonthStart: data.prepMonthStart ? new Date(data.prepMonthStart) : null }),
    ...(data.prepMonthEnd !== undefined && { prepMonthEnd: data.prepMonthEnd ? new Date(data.prepMonthEnd) : null }),
    ...(data.campaignStart !== undefined && { campaignStart: data.campaignStart ? new Date(data.campaignStart) : null }),
    ...(data.location !== undefined && { location: data.location }),
    ...(data.year !== undefined && { year: data.year }),
  };
}
