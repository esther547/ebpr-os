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
}

export function DeliverablesPageClient({ deliverables, clientId, target, teamMembers }: Props) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <div className="mb-4">
        <Button onClick={() => setShowCreate(true)}>+ New Deliverable</Button>
      </div>

      <DeliverableBoard
        deliverables={deliverables}
        clientId={clientId}
        target={target}
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
