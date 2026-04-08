import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/header";
import { Calendar, DollarSign, MessageSquare, Mail, Link2, CheckCircle, XCircle } from "lucide-react";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const hasSlack = !!process.env.SLACK_WEBHOOK_URL;
  const hasQBO = !!(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET);
  const hasGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

  const integrations = [
    {
      name: "Google Calendar / iCal Sync",
      description: "Subscribe to runner schedules and client deliverables in any calendar app. Copy the feed URL and paste into Google Calendar > Other calendars > From URL.",
      icon: <Calendar className="h-5 w-5" />,
      connected: true,
      details: "Feed URL: https://os.ebpublicrelations.com/api/calendar?token=USER_ID",
      instructions: "Replace USER_ID with the runner's user ID to get their personal feed, or use ?client=CLIENT_ID for a client-specific calendar.",
    },
    {
      name: "Slack Notifications",
      description: "Get real-time notifications in Slack when deliverables are completed, payments are overdue, or new clients are onboarded.",
      icon: <MessageSquare className="h-5 w-5" />,
      connected: hasSlack,
      instructions: hasSlack ? "Connected and active" : "1. Go to api.slack.com/messaging/webhooks\n2. Create an incoming webhook\n3. Add SLACK_WEBHOOK_URL to Vercel env vars\n4. Redeploy",
    },
    {
      name: "QuickBooks Online",
      description: "Sync invoices and payments with QuickBooks Online for accounting automation.",
      icon: <DollarSign className="h-5 w-5" />,
      connected: hasQBO,
      instructions: hasQBO ? "Configured — connect via OAuth" : "1. Create app at developer.intuit.com\n2. Add QBO_CLIENT_ID and QBO_CLIENT_SECRET to Vercel env vars\n3. Redeploy",
    },
    {
      name: "Email Digests (Gmail / Google Workspace)",
      description: "Send weekly email digests to clients from your @ebmanagement.io account. Every Monday at 9am.",
      icon: <Mail className="h-5 w-5" />,
      connected: hasGmail,
      instructions: hasGmail
        ? `Connected — sending from ${process.env.GMAIL_USER}. Digests go out every Monday at 9am.`
        : "1. Go to myaccount.google.com with your @ebmanagement.io account\n2. Security → 2-Step Verification (enable if not already)\n3. Search 'App Passwords' → Generate one for 'EBPR OS'\n4. Set GMAIL_USER and GMAIL_APP_PASSWORD in Vercel env vars\n5. Redeploy",
    },
    {
      name: "Google Docs (Strategy Import)",
      description: "Import strategy documents from Google Docs and auto-generate tasks. Already connected via service account.",
      icon: <Link2 className="h-5 w-5" />,
      connected: true,
      instructions: "Active. Share Google Docs with ebpr-docs@ebpr-492704.iam.gserviceaccount.com (Viewer) to enable import.",
    },
  ];

  return (
    <>
      <PageHeader title="Integrations" subtitle="Connect external services" />

      <div className="space-y-4">
        {integrations.map((integration) => (
          <div key={integration.name} className="rounded-lg border border-border bg-white p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 rounded-lg bg-surface-1 p-3 text-ink-muted">
                {integration.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-ink-primary">{integration.name}</h3>
                  {integration.connected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      <CheckCircle className="h-3 w-3" /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      <XCircle className="h-3 w-3" /> Not Connected
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-secondary mt-1">{integration.description}</p>
                {integration.instructions && (
                  <pre className="mt-3 rounded-md bg-surface-1 px-3 py-2 text-xs text-ink-muted whitespace-pre-wrap font-mono">
                    {integration.instructions}
                  </pre>
                )}
                {integration.details && (
                  <p className="mt-2 text-xs text-ink-muted font-mono bg-surface-1 rounded px-2 py-1 inline-block">
                    {integration.details}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
