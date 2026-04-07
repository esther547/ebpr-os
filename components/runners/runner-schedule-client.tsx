"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/header";
import { RunnerScheduleView } from "./runner-schedule-view";
import { CreateAssignmentModal } from "./create-assignment-modal";
import { Button } from "@/components/ui/form-field";

interface Props {
  assignments: any[];
  runners: { id: string; name: string; avatar: string | null }[];
  clients: { id: string; name: string }[];
  weekStart: string;
  isRunner: boolean;
}

export function RunnerScheduleClient({ assignments, runners, clients, weekStart, isRunner }: Props) {
  const [showAssign, setShowAssign] = useState(false);

  return (
    <>
      <PageHeader
        title="Runner Schedule"
        subtitle="Weekly assignments"
        actions={
          !isRunner ? (
            <Button onClick={() => setShowAssign(true)}>+ Assign Runner</Button>
          ) : undefined
        }
      />
      <RunnerScheduleView
        assignments={assignments}
        runners={runners}
        weekStart={new Date(weekStart)}
        isReadOnly={isRunner}
      />
      {!isRunner && clients.length > 0 && (
        <CreateAssignmentModal
          open={showAssign}
          onOpenChange={setShowAssign}
          runners={runners}
          clientId={clients[0].id}
        />
      )}
    </>
  );
}
