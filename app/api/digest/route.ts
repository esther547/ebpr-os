import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Weekly client digest — generates a summary for each active client
// This endpoint produces the digest data. To send emails, connect an email provider
// (e.g., Resend, SendGrid) and call this endpoint from the cron job.
//
// To activate email sending:
// 1. Set RESEND_API_KEY in Vercel env vars
// 2. Install: npm install resend
// 3. The cron job at /api/cron can call this weekly

export async function GET() {
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
    // Get this week's activity
    const recentDeliverables = await db.deliverable.findMany({
      where: {
        clientId: client.id,
        isClientVisible: true,
        updatedAt: { gte: weekAgo },
      },
      select: { title: true, type: true, status: true, outcome: true, completedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    // Get monthly pacing
    const monthDeliverables = await db.deliverable.findMany({
      where: { clientId: client.id, month, year },
      select: { status: true },
    });

    const completed = monthDeliverables.filter((d) => d.status === "COMPLETED").length;
    const completionRate = client.monthlyTarget > 0
      ? Math.round((completed / client.monthlyTarget) * 100)
      : 0;

    // Upcoming events this week
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

    const recentWins = recentDeliverables.filter((d) => d.status === "COMPLETED" && d.outcome);

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
        wins: recentWins.length,
      },
      recentDeliverables: recentDeliverables.slice(0, 5).map((d) => ({
        title: d.title,
        type: d.type,
        status: d.status,
        outcome: d.outcome,
      })),
      upcomingEvents: upcomingAssignments.map((a) => ({
        name: a.eventName,
        date: a.eventDate,
        location: a.location,
      })),
    });
  }

  return NextResponse.json({
    generated: new Date().toISOString(),
    totalClients: clients.length,
    digestsGenerated: digests.length,
    digests,
    emailStatus: process.env.RESEND_API_KEY ? "configured" : "not_configured — set RESEND_API_KEY to enable email sending",
  });
}
