"use client";

import { useState } from "react";
import { DeliverableBoard } from "./deliverable-board";
import { CreateDeliverableModal } from "./create-deliverable-modal";
import { Button } from "@/components/ui/form-field";

interface Props {
  deliverables: any[];
  clientId: string;
  target: number;
  teamMembers: { id: string; name: string }[];
  runnerNeededIds?: string[];
  clientStatus?: string;
}

export function DeliverablesPageClient({
  deliverables,
  clientId,
  target,
  teamMembers,
  runnerNeededIds = [],
  clientStatus = "ACTIVE",
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const paused = clientStatus === "PAUSED" || clientStatus === "CHURNED";

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Button onClick={() => setShowCreate(true)} disabled={paused}>+ New Deliverable</Button>
        {paused && (
          <span className="text-xs text-amber-700">
            Client is {clientStatus.toLowerCase()} — reactivate it to add deliverables.
          </span>
        )}
      </div>

      {runnerNeededIds.length > 0 && (
        <div className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          <span className="font-semibold">{runnerNeededIds.length} confirmed deliverable{runnerNeededIds.length > 1 ? "s" : ""}</span>{" "}
          still need a runner. Open the card to assign one.
        </div>
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
    </>
  );
}
