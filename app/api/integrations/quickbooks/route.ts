import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/permissions";

// QuickBooks Online Integration
// To activate:
// 1. Create app at https://developer.intuit.com
// 2. Get OAuth2 credentials (Client ID + Secret)
// 3. Set env vars: QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI
// 4. Connect via /api/integrations/quickbooks/connect

export async function GET() {
  const user = await requireUser();
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isConfigured = !!(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET);

  return NextResponse.json({
    status: isConfigured ? "configured" : "not_configured",
    connected: false, // Will be true once OAuth flow is completed
    setup_instructions: !isConfigured ? [
      "1. Go to https://developer.intuit.com and create an app",
      "2. Select 'Accounting' scope",
      "3. Set redirect URI to: https://os.ebpublicrelations.com/api/integrations/quickbooks/callback",
      "4. Add QBO_CLIENT_ID and QBO_CLIENT_SECRET to Vercel env vars",
      "5. Redeploy and connect from Settings > Integrations",
    ] : undefined,
  });
}

// POST — sync invoices to QuickBooks
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.QBO_CLIENT_ID || !process.env.QBO_CLIENT_SECRET) {
    return NextResponse.json({
      error: "QuickBooks not configured. Add QBO_CLIENT_ID and QBO_CLIENT_SECRET environment variables.",
    }, { status: 400 });
  }

  // TODO: Implement actual QBO sync once OAuth is configured
  return NextResponse.json({
    message: "QuickBooks sync will be available once OAuth connection is established. Go to Settings > Integrations to connect.",
  });
}
