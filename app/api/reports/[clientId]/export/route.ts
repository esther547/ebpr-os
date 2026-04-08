import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";

// Generates a printable HTML report that can be saved as PDF via browser print
export async function GET(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const user = await requireUser();
  if (!canViewReports(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { clientId } = await params;
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, monthlyTarget: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deliverables = await db.deliverable.findMany({
    where: { clientId, month, year, isClientVisible: true },
    select: {
      id: true, title: true, type: true, status: true, outcome: true,
      completedAt: true, dueDate: true,
      assignee: { select: { name: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  const completed = deliverables.filter((d) => d.status === "COMPLETED");
  const monthName = new Date(year, month - 1).toLocaleString("en-US", { month: "long" });
  const completionRate = client.monthlyTarget > 0
    ? Math.round((completed.length / client.monthlyTarget) * 100)
    : 0;

  const typeLabels: Record<string, string> = {
    PRESS_PLACEMENT: "Press Placement",
    INTERVIEW: "Interview",
    INFLUENCER_COLLAB: "Influencer Collaboration",
    EVENT_APPEARANCE: "Event Appearance",
    BRAND_OPPORTUNITY: "Brand Opportunity",
    INTRODUCTION: "Introduction",
    SOCIAL_MEDIA: "Social Media",
    PRESS_RELEASE: "Press Release",
    OTHER: "Other",
  };

  const statusColors: Record<string, string> = {
    COMPLETED: "#16a34a",
    CONFIRMED: "#2563eb",
    IN_PROGRESS: "#d97706",
    IDEA: "#6b7280",
    OUTREACH: "#8b5cf6",
    CANCELLED: "#dc2626",
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${client.name} — ${monthName} ${year} Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; color: #1a1a1a; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; font-weight: 700; }
    .header p { font-size: 14px; color: #666; margin-top: 4px; }
    .logo-text { font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #999; margin-bottom: 8px; }
    .stats { display: flex; gap: 20px; margin-bottom: 30px; }
    .stat-card { flex: 1; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; }
    .stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #888; }
    .stat-value { font-size: 28px; font-weight: 700; margin-top: 4px; }
    .green { color: #16a34a; }
    .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #888; margin-bottom: 12px; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #888; padding: 8px 12px; border-bottom: 2px solid #e5e5e5; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; color: #fff; }
    .type-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; background: #f3f4f6; color: #374151; }
    .wins { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-top: 20px; }
    .wins h3 { font-size: 14px; font-weight: 600; color: #16a34a; margin-bottom: 10px; }
    .win-item { padding: 8px 0; border-bottom: 1px solid #dcfce7; font-size: 13px; }
    .win-item:last-child { border-bottom: none; }
    .win-title { font-weight: 600; }
    .win-outcome { color: #15803d; margin-top: 2px; font-size: 12px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; }
    .footer p { font-size: 11px; color: #999; }
    .progress-bar { height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; margin-top: 8px; }
    .progress-fill { height: 100%; border-radius: 4px; background: #16a34a; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="text-align: right; margin-bottom: 20px;">
    <button onclick="window.print()" style="padding: 8px 20px; background: #000; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
      Save as PDF / Print
    </button>
  </div>

  <div class="header">
    <div class="logo-text">EB PUBLIC RELATIONS</div>
    <h1>${client.name}</h1>
    <p>Monthly PR Report — ${monthName} ${year}</p>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Deliverables</div>
      <div class="stat-value">${deliverables.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Completed</div>
      <div class="stat-value green">${completed.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Target</div>
      <div class="stat-value">${client.monthlyTarget}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Completion</div>
      <div class="stat-value">${completionRate}%</div>
      <div class="progress-bar"><div class="progress-fill" style="width: ${Math.min(completionRate, 100)}%"></div></div>
    </div>
  </div>

  <div class="section-title">All Deliverables</div>
  <table>
    <thead>
      <tr>
        <th>Deliverable</th>
        <th>Type</th>
        <th>Status</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      ${deliverables.map((d) => `
        <tr>
          <td><strong>${escapeHtml(d.title)}</strong></td>
          <td><span class="type-badge">${typeLabels[d.type] || d.type}</span></td>
          <td><span class="badge" style="background: ${statusColors[d.status] || "#6b7280"}">${d.status}</span></td>
          <td>${d.completedAt ? new Date(d.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : d.dueDate ? new Date(d.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
        </tr>
      `).join("")}
      ${deliverables.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #999; padding: 20px;">No deliverables for this month</td></tr>' : ""}
    </tbody>
  </table>

  ${completed.filter((d) => d.outcome).length > 0 ? `
    <div class="wins">
      <h3>Key Wins & Results</h3>
      ${completed.filter((d) => d.outcome).map((d) => `
        <div class="win-item">
          <div class="win-title">${escapeHtml(d.title)}</div>
          <div class="win-outcome">${escapeHtml(d.outcome!)}</div>
        </div>
      `).join("")}
    </div>
  ` : ""}

  <div class="footer">
    <p>Generated by EBPR OS on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
    <p>EB Public Relations — Miami, FL</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
