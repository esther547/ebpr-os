"use client";

import { cn, formatDateTime } from "@/lib/utils";
import {
  FileText, Upload, CheckCircle, Send, MessageSquare,
  UserPlus, PenLine, Zap, AlertCircle
} from "lucide-react";

type ActivityEntry = {
  id: string;
  action: string;
  description: string;
  createdAt: string | Date;
  user: { id: string; name: string; avatar?: string | null };
  client?: { id: string; name: string } | null;
  deliverable?: { id: string; title: string } | null;
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  client_created: <UserPlus className="h-3.5 w-3.5" />,
  contract_created: <FileText className="h-3.5 w-3.5" />,
  contract_updated: <PenLine className="h-3.5 w-3.5" />,
  deliverable_created: <Zap className="h-3.5 w-3.5" />,
  deliverable_updated: <PenLine className="h-3.5 w-3.5" />,
  status_changed: <CheckCircle className="h-3.5 w-3.5" />,
  file_uploaded: <Upload className="h-3.5 w-3.5" />,
  approval_requested: <Send className="h-3.5 w-3.5" />,
  approval_responded: <MessageSquare className="h-3.5 w-3.5" />,
  task_created: <AlertCircle className="h-3.5 w-3.5" />,
  onboarding_updated: <CheckCircle className="h-3.5 w-3.5" />,
  campaign_created: <Zap className="h-3.5 w-3.5" />,
  campaign_updated: <PenLine className="h-3.5 w-3.5" />,
};

export function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-ink-muted py-6 text-center">No activity yet.</p>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => (
        <div key={entry.id} className="flex gap-3 py-2.5">
          <div className="flex flex-col items-center">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-ink-secondary">
              {ACTION_ICONS[entry.action] || <Zap className="h-3.5 w-3.5" />}
            </div>
            {i < entries.length - 1 && (
              <div className="mt-1 w-px flex-1 bg-border" />
            )}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-sm text-ink-primary">
              <span className="font-medium">{entry.user.name.split(" ")[0]}</span>
              {" "}
              <span className="text-ink-secondary">{entry.description}</span>
            </p>
            <p className="text-2xs text-ink-muted mt-0.5">
              {formatDateTime(entry.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
