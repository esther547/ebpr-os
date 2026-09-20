"use client";

import { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { DeliverableBoard } from "./deliverable-board";
import { CreateDeliverableModal } from "./create-deliverable-modal";
import { Button } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/layout/header";

interface Props {
  deliverables: any[];
  clientId: string;
  target: number;
  teamMembers: { id: string; name: string }[];
  runnerNeededIds?: string[];
  clientStatus?: string;
  monthLabel?: string;
}

export function DeliverablesPageClient({
  deliverables,
  clientId,
  target,
  teamMembers,
  runnerNeededIds = [],
  clientStatus = "ACTIVE",
  monthLabel,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const paused = clientStatus === "PAUSED" || clientStatus === "CHURNED";

  return (
    <div className="space-y-6">
      <SectionHeader
        title={monthLabel ?? "Deliverables"}
        description={
          paused
            ? `Client is ${clientStatus.toLowerCase()} — reactivate it to add deliverables.`
            : `${deliverables.length} this month · target ${target}`
        }
        actions={
          <Button onClick={() => setShowCreate(true)} disabled={paused} leftIcon={<Plus className="h-4 w-4" />}>
            New Deliverable
          </Button>
        }
      />

      {runnerNeededIds.length > 0 && (
        <Card padding="sm" className="border-amber-200 bg-amber-50/60" role="status">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">
                {runnerNeededIds.length} confirmed deliverable{runnerNeededIds.length > 1 ? "s" : ""}
              </span>{" "}
              still need a runner. Open the card to assign one.
            </p>
          </div>
        </Card>
      )}

      <DeliverableBoard
        deliverables={deliverables}
        clientId={clientId}
        target={target}
        runnerNeededIds={runnerNeededIds}
      />

      <CreateDeliverableModal
        open={showCreate}
        onOpenChange={setShowCreate}
        clientId={clientId}
        teamMembers={teamMembers}
      />
    </div>
  );
}
