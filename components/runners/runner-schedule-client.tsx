"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/header";
import { RunnerScheduleView, type ScheduleAssignment } from "./runner-schedule-view";
import { CreateAssignmentModal } from "./create-assignment-modal";
import { AutoAssignButton } from "./auto-assign-button";
import { AssignRunnerModal } from "./assign-runner-modal";
import { Button } from "@/components/ui/form-field";
import { addDaysKey } from "@/components/runners/miami-time";
import { CalendarClock, Plus } from "lucide-react";

interface Props {
  assignments: ScheduleAssignment[];
  runners: { id: string; name: string; avatar: string | null; role?: string }[];
  clients: { id: string; name: string }[];
  /** Monday of the displayed week, "yyyy-MM-dd" (Miami). */
  weekStartKey: string;
  /** Monday of the current week, "yyyy-MM-dd" (Miami). */
  currentWeekKey: string;
  /** Monday of next week, "yyyy-MM-dd" (Miami). */
  nextWeekKey: string;
  /** Sunday of next week, "yyyy-MM-dd" (Miami). */
  nextWeekEndKey: string;
  /** Today, "yyyy-MM-dd" (Miami). */
  todayKey: string;
  isRunner: boolean;
}

export function RunnerScheduleClient({
  assignments,
  runners,
  clients,
  weekStartKey,
  currentWeekKey,
  nextWeekKey,
  nextWeekEndKey,
  todayKey,
  isRunner,
}: Props) {
  const [showAssign, setShowAssign] = useState(false);
  const [assignTarget, setAssignTarget] = useState<ScheduleAssignment | null>(null);

  const needsRunner = assignments.filter((a) => !a.runnerId).length;
  // The auto-assign button always builds NEXT week unless you are already
  // looking at a different one, which is what the Friday routine does.
  const isViewingCurrent = weekStartKey === currentWeekKey;
  const targetFrom = isViewingCurrent ? nextWeekKey : weekStartKey;
  const targetTo = isViewingCurrent ? nextWeekEndKey : addDaysKey(weekStartKey, 6);

  return (
    <>
      <PageHeader
        title="Runner Schedule"
        subtitle={
          needsRunner > 0
            ? `${assignments.length} activities this week · ${needsRunner} still need a runner`
            : `${assignments.length} activities this week`
        }
        actions={
          !isRunner ? (
            <>
              <Button
                asChild
                variant="ghost"
                leftIcon={<CalendarClock className="h-4 w-4" />}
              >
                <Link href="/runners/availability">Availability</Link>
              </Button>
              <AutoAssignButton
                from={targetFrom}
                to={targetTo}
                label={isViewingCurrent ? "Auto-assign next week" : "Auto-assign this week"}
              />
              <Button onClick={() => setShowAssign(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Assign Runner
              </Button>
            </>
          ) : undefined
        }
      />
      <RunnerScheduleView
        assignments={assignments}
        runners={runners}
        weekStartKey={weekStartKey}
        currentWeekKey={currentWeekKey}
        todayKey={todayKey}
        isReadOnly={isRunner}
        onAssign={setAssignTarget}
      />
      {!isRunner && clients.length > 0 && (
        <CreateAssignmentModal
          open={showAssign}
          onOpenChange={setShowAssign}
          runners={runners}
          clients={clients}
        />
      )}
      {!isRunner && (
        <AssignRunnerModal
          assignment={assignTarget}
          runners={runners}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </>
  );
}
