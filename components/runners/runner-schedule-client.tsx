"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, SectionHeader } from "@/components/layout/header";
import { AgendaAddItemButton } from "@/components/agenda/create-agenda-item-modal";
import { RunnerScheduleView, type ScheduleAssignment } from "./runner-schedule-view";
import { CreateAssignmentModal } from "./create-assignment-modal";
import { AutoAssignButton } from "./auto-assign-button";
import { AssignRunnerModal } from "./assign-runner-modal";
import { EditAgendaItemModal } from "@/components/agenda/edit-agenda-item-modal";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/form-field";
import { addDaysKey } from "@/components/runners/miami-time";
import { OpenPautas } from "@/components/runners/open-pautas";
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
  /** Runner portal: no page header, week links stay on the portal. */
  embedded?: boolean;
  /** Internal page: every future pauta with no runner (any week), listed under the week with "Assign runner". */
  openPautas?: ScheduleAssignment[];
  basePath?: string;
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
  embedded = false,
  basePath,
  openPautas,
}: Props) {
  const [showAssign, setShowAssign] = useState(false);
  const [assignTarget, setAssignTarget] = useState<ScheduleAssignment | null>(null);
  const [editTarget, setEditTarget] = useState<ScheduleAssignment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleAssignment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function removeAssignment(a: ScheduleAssignment) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/runner-assignments/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Pauta eliminada del horario", variant: "success" });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast({ title: "No se pudo eliminar la pauta", variant: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const needsRunner = assignments.filter((a) => !a.runnerId).length;
  // The auto-assign button always builds NEXT week unless you are already
  // looking at a different one, which is what the Friday routine does.
  const isViewingCurrent = weekStartKey === currentWeekKey;
  const targetFrom = isViewingCurrent ? nextWeekKey : weekStartKey;
  const targetTo = isViewingCurrent ? nextWeekEndKey : addDaysKey(weekStartKey, 6);

  return (
    <>
      {embedded ? (
        <SectionHeader
          title="Runner Schedule"
          description={needsRunner > 0 ? `${assignments.length} activities this week · ${needsRunner} still need a runner` : `${assignments.length} activities this week`}
          className="mb-0"
        />
      ) : (
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
              <AgendaAddItemButton clients={clients} runners={runners} deliverables={[]} label="Agregar evento" defaultDate={isViewingCurrent ? todayKey : weekStartKey} />
            </>
          ) : undefined
        }
      />
      )}
      <RunnerScheduleView
        assignments={assignments}
        runners={runners}
        weekStartKey={weekStartKey}
        currentWeekKey={currentWeekKey}
        todayKey={todayKey}
        isReadOnly={isRunner}
        basePath={basePath}
        onAssign={setAssignTarget}
        onEdit={setEditTarget}
        onDelete={setDeleteTarget}
      />
      {!isRunner && openPautas && (
        <section className="mt-8 space-y-4">
          <SectionHeader
            title="Pautas que necesitan runner"
            description={openPautas.length ? `${openPautas.length} pauta${openPautas.length === 1 ? "" : "s"} futura${openPautas.length === 1 ? "" : "s"} sin runner, de cualquier semana. Los runners también las ven en su portal y pueden tomarlas.` : "Todas las pautas futuras ya tienen runner."}
            className="mb-0"
          />
          <OpenPautas pautas={openPautas} onAssign={(p) => setAssignTarget(p)} />
        </section>
      )}
      {!isRunner && editTarget && (
        <EditAgendaItemModal
          open={editTarget !== null}
          onOpenChange={(o) => !o && setEditTarget(null)}
          item={{
            id: editTarget.id,
            eventName: editTarget.eventName,
            eventDate: editTarget.eventDate,
            arrivalTime: editTarget.arrivalTime ?? null,
            eventTime: editTarget.eventTime ?? null,
            venueName: editTarget.venueName,
            venueAddress: editTarget.venueAddress ?? null,
            itemType: editTarget.itemType ?? null,
            status: editTarget.status,
            notes: editTarget.notes ?? null,
            internalNotes: editTarget.internalNotes ?? null,
            runner: editTarget.runner ? { id: editTarget.runner.id, name: editTarget.runner.name } : null,
          }}
          runners={runners}
        />
      )}
      {!isRunner && (
        <ConfirmModal
          open={deleteTarget !== null}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          title="Eliminar pauta del horario"
          description={deleteTarget ? `${deleteTarget.clientName ? deleteTarget.clientName + " · " : ""}${deleteTarget.eventName}. Si tiene runner asignado, se le avisa.` : undefined}
          confirmLabel="Eliminar"
          destructive
          loading={deleting}
          onConfirm={() => { if (deleteTarget) void removeAssignment(deleteTarget); }}
        />
      )}
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
