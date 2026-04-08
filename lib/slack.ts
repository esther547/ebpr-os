// Slack Webhook Integration
// To activate: Set SLACK_WEBHOOK_URL in Vercel env vars
// Get webhook URL from: https://api.slack.com/messaging/webhooks

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

export async function sendSlackNotification(message: {
  text: string;
  blocks?: unknown[];
}) {
  if (!WEBHOOK_URL) return; // silently skip if not configured

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (err) {
    console.error("Slack notification failed:", err);
  }
}

// Pre-built notification templates
export function slackDeliverableCompleted(clientName: string, title: string, outcome?: string) {
  return sendSlackNotification({
    text: `Deliverable completed for ${clientName}: ${title}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Deliverable Completed* :white_check_mark:\n*Client:* ${clientName}\n*Deliverable:* ${title}${outcome ? `\n*Outcome:* ${outcome}` : ""}`,
        },
      },
    ],
  });
}

export function slackOverduePayment(clientName: string, daysOverdue: number) {
  return sendSlackNotification({
    text: `Payment overdue for ${clientName} (${daysOverdue} days)`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Payment Overdue* :warning:\n*Client:* ${clientName}\n*Days Overdue:* ${daysOverdue}`,
        },
      },
    ],
  });
}

export function slackNewClient(clientName: string) {
  return sendSlackNotification({
    text: `New client onboarded: ${clientName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*New Client* :tada:\n*${clientName}* has been added to EBPR OS`,
        },
      },
    ],
  });
}

export function slackRunnerAssigned(runnerName: string, eventName: string, date: string) {
  return sendSlackNotification({
    text: `Runner ${runnerName} assigned to ${eventName} on ${date}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Runner Assigned* :calendar:\n*Runner:* ${runnerName}\n*Event:* ${eventName}\n*Date:* ${date}`,
        },
      },
    ],
  });
}
