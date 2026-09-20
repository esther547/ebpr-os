import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MessageSquare, Mail, Link2 } from "lucide-react";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const hasSlack = !!process.env.SLACK_WEBHOOK_URL;
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
      description: "Get real-time notifications in Slack when deliverables are completed or new clients are onboarded.",
      icon: <MessageSquare className="h-5 w-5" />,
      connected: hasSlack,
      instructions: hasSlack ? "Connected and active" : "1. Go to api.slack.com/messaging/webhooks\n2. Create an incoming webhook\n3. Add SLACK_WEBHOOK_URL to Vercel env vars\n4. Redeploy",
    },
    {
      name: "Email Digests (Gmail / Google Workspace)",
      description: "Send weekly email digests to clients from your @ebmanagement.io account. Automatic sending is disabled — digests only go out when triggered manually.",
      icon: <Mail className="h-5 w-5" />,
      connected: hasGmail,
      instructions: hasGmail
        ? `Connected — sending from ${process.env.GMAIL_USER}. Preview: GET /api/digest. Send: POST /api/digest (manual only; no cron).`
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

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Connect external services"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Integrations" }]}
        actions={
          <Badge tone="neutral" size="md">
            {connectedCount} of {integrations.length} connected
          </Badge>
        }
      />

      <div className="space-y-6">
        {integrations.map((integration) => (
          <Card key={integration.name} padding="lg">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-secondary">
                {integration.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink-primary">{integration.name}</h3>
                  <Badge tone={integration.connected ? "success" : "neutral"} dot>
                    {integration.connected ? "Connected" : "Not connected"}
                  </Badge>
                </div>
                <p className="mt-1 max-w-prose text-sm text-ink-secondary">{integration.description}</p>
                {integration.instructions && (
                  <>
                    <p className="eyebrow mt-4">
                      {integration.connected ? "Details" : "Setup steps"}
                    </p>
                    <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-1 px-3 py-2.5 font-mono text-xs leading-relaxed text-ink-secondary">
                      {integration.instructions}
                    </pre>
                  </>
                )}
                {integration.details && (
                  <p className="mt-2 overflow-x-auto rounded-lg border border-border bg-surface-1 px-3 py-2 font-mono text-xs text-ink-muted">
                    {integration.details}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
