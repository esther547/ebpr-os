import nodemailer from "nodemailer";

// ─── Gmail SMTP via Google Workspace (@ebmanagement.io) ──
//
// To activate:
// 1. Go to myaccount.google.com with the sender's @ebmanagement.io account
// 2. Security → 2-Step Verification (must be enabled)
// 3. Search "App Passwords" → Generate one for "EBPR OS"
// 4. Set these env vars in Vercel:
//    GMAIL_USER=sender@ebmanagement.io (or @ebpublicrelations.com)
//    GMAIL_APP_PASSWORD=the-16-char-app-password
// 5. Redeploy

const transporter = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  : null;

export function isEmailConfigured(): boolean {
  return !!transporter;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  if (!transporter) {
    console.log("[Email] Not configured — set GMAIL_USER + GMAIL_APP_PASSWORD");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"EB Public Relations" <${process.env.GMAIL_USER}>`,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
      text: text || subject,
    });
    return true;
  } catch (err) {
    console.error("[Email] Failed to send:", err);
    return false;
  }
}

// ─── Email Templates ─────────────────────────────────────

export function digestEmailHtml({
  clientName,
  contactName,
  monthlyProgress,
  weekActivity,
  wins,
  upcomingEvents,
  monitorLink,
  deliverables,
}: {
  clientName: string;
  contactName: string | null;
  monthlyProgress: string;
  weekActivity: number;
  wins: { title: string; outcome: string }[];
  upcomingEvents: { name: string; date: string; location: string | null }[];
  monitorLink: string | null;
  deliverables: { title: string; type: string; status: string }[];
}): string {
  const greeting = contactName ? `Hi ${contactName.split(" ")[0]},` : `Hi,`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: #0a0a0a; color: #fff; padding: 24px 30px; }
    .header h1 { font-size: 18px; font-weight: 600; letter-spacing: 2px; margin: 0; }
    .header p { font-size: 12px; color: #999; margin: 4px 0 0; }
    .body { padding: 30px; }
    .greeting { font-size: 15px; margin-bottom: 20px; }
    .stat-row { display: flex; gap: 12px; margin-bottom: 20px; }
    .stat { flex: 1; background: #f9f9f9; border-radius: 8px; padding: 14px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 700; }
    .stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #888; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    .win { background: #f0fdf4; border-left: 3px solid #16a34a; padding: 10px 14px; margin-bottom: 8px; border-radius: 0 6px 6px 0; }
    .win-title { font-weight: 600; font-size: 13px; }
    .win-outcome { font-size: 12px; color: #15803d; margin-top: 2px; }
    .event { background: #f0f4ff; border-left: 3px solid #2563eb; padding: 10px 14px; margin-bottom: 8px; border-radius: 0 6px 6px 0; }
    .event-name { font-weight: 600; font-size: 13px; }
    .event-detail { font-size: 12px; color: #4b5563; margin-top: 2px; }
    .deliverable { padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; display: flex; justify-content: space-between; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .badge-completed { background: #dcfce7; color: #166534; }
    .badge-confirmed { background: #dbeafe; color: #1e40af; }
    .badge-progress { background: #fef3c7; color: #92400e; }
    .cta { display: inline-block; background: #0a0a0a; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 600; margin-top: 12px; }
    .footer { background: #f9f9f9; padding: 20px 30px; text-align: center; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>EB PUBLIC RELATIONS</h1>
      <p>Weekly PR Update for ${clientName}</p>
    </div>
    <div class="body">
      <p class="greeting">${greeting}</p>
      <p style="font-size: 14px; color: #444; margin-bottom: 24px;">
        Here's your weekly PR activity summary from EB Public Relations.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td style="background: #f9f9f9; border-radius: 8px; padding: 14px; text-align: center; width: 50%;">
            <div style="font-size: 24px; font-weight: 700;">${weekActivity}</div>
            <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px;">This Week</div>
          </td>
          <td width="12"></td>
          <td style="background: #f9f9f9; border-radius: 8px; padding: 14px; text-align: center; width: 50%;">
            <div style="font-size: 24px; font-weight: 700;">${monthlyProgress}</div>
            <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Monthly Progress</div>
          </td>
        </tr>
      </table>

      ${wins.length > 0 ? `
        <div class="section">
          <div class="section-title">Key Wins</div>
          ${wins.map((w) => `
            <div class="win">
              <div class="win-title">${w.title}</div>
              <div class="win-outcome">${w.outcome}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${upcomingEvents.length > 0 ? `
        <div class="section">
          <div class="section-title">Upcoming This Week</div>
          ${upcomingEvents.map((e) => `
            <div class="event">
              <div class="event-name">${e.name}</div>
              <div class="event-detail">${new Date(e.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${e.location ? ` — ${e.location}` : ""}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${deliverables.length > 0 ? `
        <div class="section">
          <div class="section-title">Recent Activity</div>
          ${deliverables.map((d) => {
            const badgeClass = d.status === "COMPLETED" ? "badge-completed" : d.status === "CONFIRMED" ? "badge-confirmed" : "badge-progress";
            return `<div class="deliverable"><span>${d.title}</span><span class="badge ${badgeClass}">${d.status}</span></div>`;
          }).join("")}
        </div>
      ` : ""}

      ${monitorLink ? `<a href="${monitorLink}" class="cta">View Full Dashboard</a>` : ""}
    </div>
    <div class="footer">
      <p>EB Public Relations — Miami, FL</p>
      <p>This is an automated weekly update from EBPR OS</p>
    </div>
  </div>
</body>
</html>`;
}
