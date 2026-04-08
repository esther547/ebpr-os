import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  signerEmail: z.string().email(),
  signerName: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManageContracts(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const contract = await db.contract.findUnique({ where: { id } });
  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Create signature request with unique token
  const signature = await db.contractSignature.create({
    data: {
      contractId: id,
      signerEmail: parsed.data.signerEmail,
      signerName: parsed.data.signerName,
    },
  });

  // Update contract status to SENT
  await db.contract.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });

  // The signing link
  const signingUrl = `${req.nextUrl.origin}/sign/${signature.token}`;

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: contract.clientId,
      action: "contract_sent_for_signature",
      description: `Sent contract "${contract.title}" to ${parsed.data.signerName} (${parsed.data.signerEmail})`,
    },
  });

  return NextResponse.json({
    data: signature,
    signingUrl,
    message: `Signing link generated for ${parsed.data.signerName}. Share this link: ${signingUrl}`,
  }, { status: 201 });
}
