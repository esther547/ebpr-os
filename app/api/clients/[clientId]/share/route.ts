import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

// POST: generate or return existing share token for a client
export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const user = await requireUser();
  if (!canManageClients(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { clientId } = await params;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, shareToken: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // If already has a token, return it
  if (client.shareToken) {
    const url = `${req.nextUrl.origin}/monitor/${client.shareToken}`;
    return NextResponse.json({ shareToken: client.shareToken, url });
  }

  // Generate new token
  const token = randomBytes(16).toString("hex");
  await db.client.update({
    where: { id: clientId },
    data: { shareToken: token },
  });

  const url = `${req.nextUrl.origin}/monitor/${token}`;
  return NextResponse.json({ shareToken: token, url });
}

// DELETE: revoke share token
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const user = await requireUser();
  if (!canManageClients(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { clientId } = await params;
  await db.client.update({
    where: { id: clientId },
    data: { shareToken: null },
  });

  return NextResponse.json({ message: "Share link revoked" });
}
