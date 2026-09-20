"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { Badge, humanize, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/layout/header";
import { CreateCampaignModal } from "./create-campaign-modal";
import { Calendar, FileText, CheckSquare, Target, Plus, Megaphone } from "lucide-react";

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

interface Props {
  campaigns: Campaign[];
  clientId: string;
  teamMembers: { id: string; name: string }[];
}

export function CampaignList({ campaigns, clientId, teamMembers }: Props) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Campaigns"
        description={`${campaigns.length} total`}
        actions={
          <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>
            New Campaign
          </Button>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title="No campaigns yet"
          description="Create the first campaign for this client."
          action={
            <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" />}>
              New Campaign
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} interactive>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-base font-semibold text-ink-primary">{campaign.name}</h3>
                    <Badge tone={statusTone(campaign.status)} dot>
                      {humanize(campaign.status)}
                    </Badge>
                  </div>
                  {campaign.description && (
                    <p className="mt-1 text-sm text-ink-secondary">{campaign.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
                  <Target className="h-3.5 w-3.5" />
                  <span className="tabular">{campaign.monthlyTarget}</span>/mo
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(campaign.startDate)} — {formatDate(campaign.endDate)}
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="tabular">{campaign._count.deliverables}</span> deliverables
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span className="tabular">{campaign._count.tasks}</span> tasks
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateCampaignModal
        open={showCreate}
        onOpenChange={setShowCreate}
        clientId={clientId}
        teamMembers={teamMembers}
      />
    </div>
  );
}
