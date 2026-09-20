import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, digestEmailHtml, isEmailConfigured } from "@/lib/email";
import { authorizeCron, NO_STORE } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

// Weekly client digest — generates + sends email summaries
// GET = preview digests (never sends). POST = send them.
// AUTO-SEND IS DISABLED ON PURPOSE: there is no cron entry for this route in vercel.json,
// and Vercel crons only ever issue GET requests. Emails go out only when someone
// explicitly POSTs here (SUPER_ADMIN in the browser, or a caller with CRON_SECRET).

export async function GET(req: NextRequest) {
  const denied = await authorizeCron(req);
  if (denied) return denied;

  const digests = await generateDigests();
  return NextResponse.json(
    {
      generated: new Date().toISOString(),
      preview: true,
      autoSend: false,
      emailConfigured: isEmailConfigured(),
      totalClients: digests.totalClients,
      digestsGenerated: digests.digests.length,
      digestsWithoutContact: digests.digests.filter((d) => !d.contactEmail).length,
      digests: digests.digests,
      setupInstructions: !isEmailConfigured() ? "Set GMAIL_USER + GMAIL_APP_PASSWORD in Vercel env vars to enable email sending" : undefined,
    },
    { headers: NO_STORE }
  );
}

export async function POST(req: NextRequest) {
  const denied = await authorizeCron(req);
  if (denied) return denied;

  if (!isEmailConfigured()) {
    return NextResponse.json({
      error: "Email not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in Vercel env vars.",
      instructions: [
        "1. Go to myaccount.google.com with your @ebmanagement.io account",
        "2. Security → 2-Step Verification (enable if not already)",
        "3. Search 'App Passwords' → Generate one for 'EBPR OS'",
        "4. Set GMAIL_USER and GMAIL_APP_PASSWORD in Vercel env vars",
        "5. Redeploy",
      ],
    }, { status: 400 });
  }

  const { digests } = await generateDigests();
  let sent = 0;
  let failed = 0;
  let skippedNoContact = 0;
  const failures: string[] = [];

  for (const digest of digests) {
    if (!digest.contactEmail) {
      skippedNoContact++;
      continue;
    }

    const html = digestEmailHtml({
      clientName: digest.client,
      contactName: digest.contactName,
      monthlyProgress: digest.summary.monthlyProgress,
      weekActivity: digest.summary.weekActivity,
      wins: digest.recentDeliverables
        .filter((d) => d.status === "COMPLETED" && d.outcome)
        .map((d) => ({ title: d.title, outcome: d.outcome! })),
      upcomingEvents: digest.upcomingEvents.map((e) => ({
        name: e.name,
        date: e.date,
        location: e.location,
      })),
      monitorLink: digest.monitorLink,
      deliverables: digest.recentDeliverables.slice(0, 5),
    });

    const success = await sendEmail({
      to: digest.contactEmail,
      subject: `Weekly PR Update — ${digest.client}`,
      html,
    });

    if (success) sent++;
    else {
      failed++;
      failures.push(digest.client);
    }
  }

  return NextResponse.json(
    {
      sent,
      failed,
      skippedNoContact,
      failures,
      totalDigests: digests.length,
      timestamp: new Date().toISOString(),
    },
    { headers: NO_STORE }
  );
}

// ─── Digest Generator ────────────────────────────────────

async function generateDigests() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      monthlyTarget: true,
      shareToken: true,
      contacts: {
        where: { isPrimary: true },
        select: { email: true, name: true },
      },
    },
  });

  const digests = [];

  for (const client of clients) {
    const recentDeliverables = await db.deliverable.findMany({
      where: {
        clientId: client.id,
        isClientVisible: true,
        updatedAt: { gte: weekAgo },
      },
      select: { title: true, type: true, status: true, outcome: true, completedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    const monthDeliverables = await db.deliverable.findMany({
      where: { clientId: client.id, month, year },
      select: { status: true },
    });

    const completed = monthDeliverables.filter((d) => d.status === "COMPLETED").length;
    const completionRate = client.monthlyTarget > 0
      ? Math.round((completed / client.monthlyTarget) * 100)
      : 0;

    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingAssignments = await db.runnerAssignment.findMany({
      where: {
        clientId: client.id,
        eventDate: { gte: now, lte: nextWeek },
        status: { not: "CANCELLED" },
      },
      select: { eventName: true, eventDate: true, location: true },
      orderBy: { eventDate: "asc" },
    });

    if (recentDeliverables.length === 0 && upcomingAssignments.length === 0) continue;

    digests.push({
      client: client.name,
      contactEmail: client.contacts[0]?.email || null,
      contactName: client.contacts[0]?.name || null,
      monitorLink: client.shareToken ? `https://os.ebpublicrelations.com/monitor/${client.shareToken}` : null,
      summary: {
        weekActivity: recentDeliverables.length,
        monthlyProgress: `${completed}/${client.monthlyTarget} (${completionRate}%)`,
        upcomingEvents: upcomingAssignments.length,
        wins: recentDeliverables.filter((d) => d.status === "COMPLETED" && d.outcome).length,
      },
      recentDeliverables: recentDeliverables.slice(0, 5).map((d) => ({
        title: d.title,
        type: d.type,
        status: d.status,
        outcome: d.outcome,
      })),
      upcomingEvents: upcomingAssignments.map((a) => ({
        name: a.eventName,
        date: a.eventDate.toISOString(),
        location: a.location,
      })),
    });
  }

  return { totalClients: clients.length, digests };
}
