"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatDayKey } from "@/components/runners/miami-time";

export type AutoAssignReport = {
  assigned: {
    id: string;
    eventName: string;
    dayKey: string;
    time: string | null;
    runnerId: string;
    runnerName: string;
  }[];
  unassigned: { id: string; eventName: string; dayKey: string; reason: string }[];
  from: string;
  to: string;
};

/**
 * Builds the schedule for a week from the runners' availability and shows what
 * the engine decided — including everything it could not place.
 */
export function AutoAssignButton({
  from,
  to,
  label = "Auto-assign next week",
}: {
  /** Miami day keys. Omitted = next Monday..Sunday (the API's default). */
  from?: string;
  to?: string;
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AutoAssignReport | null>(null);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/runner-assignments/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: typeof body?.error === "string" ? body.error : "Could not build the schedule",
          variant: "error",
        });
        return;
      }

      const data = body.data as AutoAssignReport;
      setReport(data);
      const total = data.assigned.length + data.unassigned.length;
      if (total === 0) {
        toast({ title: "Nothing to schedule", description: "No activities in that week yet." });
      } else if (data.unassigned.length === 0) {
        toast({
          title: `${data.assigned.length} assigned`,
          description: "Every activity has a runner.",
          variant: "success",
        });
      } else {
        toast({
          title: `${data.assigned.length} assigned, ${data.unassigned.length} still need a runner`,
          variant: "default",
        });
      }
      router.refresh();
    } catch {
      toast({ title: "Network error — please try again", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  const total = report ? report.assigned.length + report.unassigned.length : 0;

  return (
    <>
      <Button
        variant="secondary"
        loading={loading}
        leftIcon={<Wand2 className="h-4 w-4" />}
        onClick={() => void run()}
      >
        {label}
      </Button>

      <Modal
        open={!!report}
        onOpenChange={(open) => !open && setReport(null)}
        title="Schedule built"
        description={
          report
            ? `${formatDayKey(report.from, "MMM d")} – ${formatDayKey(report.to, "MMM d, yyyy")}`
            : undefined
        }
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setReport(null)}>
            Close
          </Button>
        }
      >
        {report && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Activities" value={total} />
              <StatTile
                label="Assigned"
                value={report.assigned.length}
                tone="success"
                hint={report.assigned.length ? "from weekly availability" : undefined}
              />
              <StatTile
                label="Need a runner"
                value={report.unassigned.length}
                tone={report.unassigned.length ? "danger" : "neutral"}
              />
            </div>

            {total === 0 && (
              <EmptyState
                compact
                title="No activities in this week"
                description="Confirm a goal or add an activity and it will appear here automatically."
              />
            )}

            {report.assigned.length > 0 && (
              <section className="space-y-2">
                <p className="eyebrow">Assigned</p>
                <TableWrap>
                  <Table className="min-w-[420px]">
                    <thead>
                      <tr>
                        <Th>Day</Th>
                        <Th>Activity</Th>
                        <Th>Runner</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.assigned.map((a) => (
                        <tr key={a.id}>
                          <Td className="whitespace-nowrap text-xs text-ink-secondary">
                            {formatDayKey(a.dayKey, "EEE, MMM d")}
                            {a.time && <span className="ml-1 tabular text-ink-muted">{a.time}</span>}
                          </Td>
                          <Td className="text-xs font-medium text-ink-primary">{a.eventName}</Td>
                          <Td className="text-xs text-ink-secondary">{a.runnerName}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </section>
            )}

            {report.unassigned.length > 0 && (
              <section className="space-y-2">
                <p className="eyebrow">Still need a runner</p>
                <TableWrap>
                  <Table className="min-w-[420px]">
                    <thead>
                      <tr>
                        <Th>Day</Th>
                        <Th>Activity</Th>
                        <Th>Why</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.unassigned.map((a) => (
                        <tr key={a.id}>
                          <Td className="whitespace-nowrap text-xs text-ink-secondary">
                            {formatDayKey(a.dayKey, "EEE, MMM d")}
                          </Td>
                          <Td className="text-xs font-medium text-ink-primary">
                            <span className="mr-2">{a.eventName}</span>
                            <Badge tone="danger" size="xs">
                              Needs runner
                            </Badge>
                          </Td>
                          <Td className="text-xs text-ink-muted">{a.reason}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </section>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
