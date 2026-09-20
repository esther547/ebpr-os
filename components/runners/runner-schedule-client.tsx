"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/header";
import { RunnerScheduleView, type ScheduleAssignment } from "./runner-schedule-view";
import { CreateAssignmentModal } from "./create-assignment-modal";
import { Button } from "@/components/ui/form-field";
import { Plus } from "lucide-react";

interface Props {
  assignments: ScheduleAssignment[];
  runners: { id: string; name: string; avatar: string | null }[];
  clients: { id: string; name: string }[];
  /** Monday of the current week, "yyyy-MM-dd" (Miami). */
  weekStartKey: string;
  /** Today, "yyyy-MM-dd" (Miami). */
  todayKey: string;
  isRunner: boolean;
}

export function RunnerScheduleClient({
  assignments,
  runners,
  clients,
  weekStartKey,
  todayKey,
  isRunner,
}: Props) {
  const [showAssign, setShowAssign] = useState(false);

  return (
    <>
      <PageHeader
        title="Runner Schedule"
        subtitle="Weekly assignments"
        actions={
          !isRunner ? (
            <Button
              onClick={() => setShowAssign(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Assign Runner
            </Button>
          ) : undefined
        }
      />
      <RunnerScheduleView
        assignments={assignments}
        runners={runners}
        weekStartKey={weekStartKey}
        todayKey={todayKey}
        isReadOnly={isRunner}
      />
      {!isRunner && clients.length > 0 && (
        <CreateAssignmentModal
          open={showAssign}
          onOpenChange={setShowAssign}
          runners={runners}
          clients={clients}
        />
      )}
    </>
  );
}
