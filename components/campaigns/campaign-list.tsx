"use client";

import { useState } from "react";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { CreateCampaignModal } from "./create-campaign-modal";
import { Calendar, FileText, CheckSquare, Target } from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  monthlyTarget: number;
  _count: { deliverables: number; tasks: number; strategyItems: number };
};

const STATUS_STYLES: Record<string, string> = {
  PREPARATION: "bg-amber-50 text-amber-700",
  ACTIVE: "bg-green-50 text-green-700",
  PAUSED: "bg-surface-2 text-ink-secondary",
  COMPLETED: "bg-blue-50 text-blue-700",
};

interface Props {
  campaigns: Campaign[];
  clientId: string;
  teamMembers: { id: string; name: string }[];
}

export function CampaignList({ campaigns, clientId, teamMembers }: Props) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <div className="mb-6">
        <Button onClick={() => setShowCreate(true)}>+ New Campaign</Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-ink-primary">No campaigns yet</p>
          <p className="mt-1 text-sm text-ink-muted">Create the first campaign for this client.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-lg border border-border bg-white p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-ink-primary">{campaign.name}</h3>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[campaign.status] || "bg-surface-2 text-ink-secondary")}>
                      {campaign.status.charAt(0) + campaign.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                  {campaign.description && (
                    <p className="mt-1 text-sm text-ink-secondary">{campaign.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-ink-muted">
                  <Target className="h-3.5 w-3.5" />
                  {campaign.monthlyTarget}/mo
                </div>
              </div>

              <div className="mt-4 flex items-center gap-6 text-xs text-ink-muted">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(campaign.startDate)} — {formatDate(campaign.endDate)}
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {campaign._count.deliverables} deliverables
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5" />
                  {campaign._count.tasks} tasks
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateCampaignModal
        open={showCreate}
        onOpenChange={setShowCreate}
        clientId={clientId}
        teamMembers={teamMembers}
      />
    </>
  );
}
