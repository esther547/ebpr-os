import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";

// AI Strategy Suggestions — analyzes client history and suggests next moves
export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const user = await requireUser();
  if (!canManageClients(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { clientId } = await params;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Gather client data
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, monthlyTarget: true, industry: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deliverables = await db.deliverable.findMany({
    where: { clientId },
    select: { type: true, status: true, month: true, year: true, title: true, outcome: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const strategyItems = await db.strategyItem.findMany({
    where: { clientId },
    select: { title: true, category: true, status: true },
  });

  // Analyze patterns
  const completedByType: Record<string, number> = {};
  const typesUsed = new Set<string>();
  const allTypes = ["PRESS_PLACEMENT", "INTERVIEW", "INFLUENCER_COLLAB", "EVENT_APPEARANCE", "BRAND_OPPORTUNITY", "SOCIAL_MEDIA", "PRESS_RELEASE"];

  for (const d of deliverables) {
    typesUsed.add(d.type);
    if (d.status === "COMPLETED") {
      completedByType[d.type] = (completedByType[d.type] || 0) + 1;
    }
  }

  const unusedTypes = allTypes.filter((t) => !typesUsed.has(t));
  const thisMonthDeliverables = deliverables.filter((d) => d.month === currentMonth && d.year === currentYear);
  const pacing = thisMonthDeliverables.length;
  const behindTarget = pacing < client.monthlyTarget;

  // Generate suggestions
  const suggestions: { title: string; description: string; priority: string; type: string }[] = [];

  // Pacing suggestions
  if (behindTarget) {
    const deficit = client.monthlyTarget - pacing;
    suggestions.push({
      title: `${deficit} more deliverables needed this month`,
      description: `${client.name} has ${pacing} deliverables but targets ${client.monthlyTarget}. Consider adding ${deficit} more to stay on track.`,
      priority: "HIGH",
      type: "pacing",
    });
  }

  // Diversification suggestions
  if (unusedTypes.length > 0) {
    const typeLabels: Record<string, string> = {
      PRESS_PLACEMENT: "Press Placements",
      INTERVIEW: "Interviews",
      INFLUENCER_COLLAB: "Influencer Collaborations",
      EVENT_APPEARANCE: "Event Appearances",
      BRAND_OPPORTUNITY: "Brand Opportunities",
      SOCIAL_MEDIA: "Social Media",
      PRESS_RELEASE: "Press Releases",
    };
    const missing = unusedTypes.slice(0, 3).map((t) => typeLabels[t] || t);
    suggestions.push({
      title: `Diversify with ${missing[0]}`,
      description: `${client.name} hasn't had any ${missing.join(", ")}. Exploring these channels could expand reach and visibility.`,
      priority: "MEDIUM",
      type: "diversification",
    });
  }

  // Success pattern suggestions
  const topType = Object.entries(completedByType).sort((a, b) => b[1] - a[1])[0];
  if (topType && topType[1] >= 3) {
    const typeLabels: Record<string, string> = {
      PRESS_PLACEMENT: "press placements",
      INTERVIEW: "interviews",
      INFLUENCER_COLLAB: "influencer collaborations",
      EVENT_APPEARANCE: "event appearances",
    };
    suggestions.push({
      title: `Double down on ${typeLabels[topType[0]] || topType[0]}`,
      description: `${client.name} has completed ${topType[1]} successful ${typeLabels[topType[0]] || topType[0]}. This is their strongest channel — consider scheduling more.`,
      priority: "MEDIUM",
      type: "pattern",
    });
  }

  // Strategy items that are still ideas
  const pendingStrategy = strategyItems.filter((s) => s.status === "IDEA" || s.status === "APPROVED");
  if (pendingStrategy.length > 0) {
    suggestions.push({
      title: `${pendingStrategy.length} strategy items ready to activate`,
      description: `There are ${pendingStrategy.length} approved/idea strategy items waiting to be converted to deliverables: "${pendingStrategy[0].title}"${pendingStrategy.length > 1 ? ` and ${pendingStrategy.length - 1} more` : ""}.`,
      priority: "MEDIUM",
      type: "strategy",
    });
  }

  // Wins without outcomes documented
  const completedNoOutcome = deliverables.filter((d) => d.status === "COMPLETED" && !d.outcome);
  if (completedNoOutcome.length >= 3) {
    suggestions.push({
      title: `Document outcomes for ${completedNoOutcome.length} deliverables`,
      description: `${completedNoOutcome.length} completed deliverables don't have outcomes recorded. Adding results helps with client reporting.`,
      priority: "LOW",
      type: "documentation",
    });
  }

  return NextResponse.json({
    data: {
      client: client.name,
      thisMonth: { deliverables: pacing, target: client.monthlyTarget, onTrack: !behindTarget },
      suggestions,
      stats: { totalDeliverables: deliverables.length, completedByType, unusedTypes },
    },
  });
}
