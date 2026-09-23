import { notFound } from "next/navigation";
import { Check, Rocket } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, cn } from "@/lib/utils";
import { OnboardingActions } from "@/components/clients/onboarding-actions";
import { ClientHeader } from "@/components/clients/client-header";
import { availabilityNowFor } from "@/lib/client-availability";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type Props = { params: { clientId: string } };

export const metadata = { title: "Onboarding" };
export const dynamic = "force-dynamic";

const STATUS_STEPS = [
  { key: "NOT_STARTED", label: "Not Started" },
  { key: "KICKOFF_SCHEDULED", label: "Kickoff Scheduled" },
  { key: "KICKOFF_COMPLETE", label: "Kickoff Complete" },
  { key: "QUESTIONNAIRE_SENT", label: "Questionnaire Sent" },
  { key: "QUESTIONNAIRE_RECEIVED", label: "Questionnaire Received" },
  { key: "STRATEGY_IN_PROGRESS", label: "Strategy In Progress" },
  { key: "COMPLETE", label: "Complete" },
];

export default async function OnboardingPage({ params }: Props) {
  await requireUser();

  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, name: true, status: true, monthlyTarget: true, industry: true, cycleDay: true, goalsOwed: true, focusNote: true, agendaDocUrl: true },
  });
  if (!client) notFound();
  const availabilityNow = await availabilityNowFor(client.id);

  const onboarding = await db.onboarding.findUnique({
    where: { clientId: params.clientId },
    include: { checklistItems: { orderBy: { order: "asc" } } },
  });

  const currentStepIdx = onboarding
    ? Math.max(0, STATUS_STEPS.findIndex((s) => s.key === onboarding.status))
    : 0;

  return (
    <>
      <ClientHeader availabilityNow={availabilityNow}
        client={client}
        actions={
          <OnboardingActions
            clientId={client.id}
            status={onboarding?.status ?? null}
            kickoffDate={onboarding?.kickoffDate ?? null}
          />
        }
      />

      <div className="space-y-6">
        {/* Progress stepper */}
        <Card padding="lg">
          <CardHeader eyebrow="Progress" title="Onboarding steps" />
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-[560px] items-start">
              {STATUS_STEPS.map((step, i) => {
                const isDone = i < currentStepIdx;
                const isCurrent = i === currentStepIdx;

                return (
                  <div key={step.key} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                          isDone
                            ? "border-ink-primary bg-ink-primary text-ink-inverted"
                            : isCurrent
                            ? "border-ink-primary bg-white text-ink-primary"
                            : "border-border bg-white text-ink-muted"
                        )}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <p
                        className={cn(
                          "mt-1.5 max-w-[80px] text-center text-2xs leading-tight",
                          isCurrent
                            ? "font-semibold text-ink-primary"
                            : isDone
                            ? "text-ink-secondary"
                            : "text-ink-muted"
                        )}
                      >
                        {step.label}
                      </p>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div
                        className={cn(
                          "mx-1 mb-5 h-0.5 flex-1 transition-colors",
                          i < currentStepIdx ? "bg-ink-primary" : "bg-border"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {onboarding ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Kickoff notes */}
            <Card padding="lg">
              <CardHeader title="Kickoff Meeting" />
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="eyebrow">Date</dt>
                  <dd className="mt-0.5 font-medium text-ink-primary">{formatDate(onboarding.kickoffDate)}</dd>
                </div>
                {onboarding.narrative && (
                  <div>
                    <dt className="eyebrow">Narrative</dt>
                    <dd className="mt-0.5 text-ink-secondary">{onboarding.narrative}</dd>
                  </div>
                )}
                {onboarding.brandPositioning && (
                  <div>
                    <dt className="eyebrow">Brand Positioning</dt>
                    <dd className="mt-0.5 text-ink-secondary">{onboarding.brandPositioning}</dd>
                  </div>
                )}
                {onboarding.vision && (
                  <div>
                    <dt className="eyebrow">Vision</dt>
                    <dd className="mt-0.5 text-ink-secondary">{onboarding.vision}</dd>
                  </div>
                )}
              </dl>
            </Card>

            {/* Questionnaire */}
            <Card padding="lg">
              <CardHeader title="Questionnaire" />
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="eyebrow">Sent</dt>
                  <dd className="mt-0.5 font-medium text-ink-primary">
                    {formatDate(onboarding.questionnaireSentAt)}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Received</dt>
                  <dd className="mt-0.5 font-medium text-ink-primary">
                    {formatDate(onboarding.questionnaireCompletedAt)}
                  </dd>
                </div>
              </dl>
              {onboarding.questionnaireResponses && (
                <div className="mt-4">
                  <p className="eyebrow mb-2">Responses</p>
                  <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-surface-1 p-3 text-2xs text-ink-secondary">
                    {JSON.stringify(onboarding.questionnaireResponses, null, 2)}
                  </pre>
                </div>
              )}
            </Card>

            {/* Checklist */}
            {onboarding.checklistItems.length > 0 && (
              <Card padding="lg" className="lg:col-span-2">
                <CardHeader title="Onboarding Checklist" />
                <ul className="divide-y divide-border">
                  {onboarding.checklistItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          item.completed ? "border-ink-primary bg-ink-primary" : "border-border"
                        )}
                      >
                        {item.completed && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className={cn(item.completed ? "text-ink-muted line-through" : "text-ink-primary")}>
                        {item.label}
                      </span>
                      {item.completedAt && (
                        <span className="ml-auto shrink-0 text-xs text-ink-muted">
                          {formatDate(item.completedAt)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        ) : (
          <EmptyState
            icon={<Rocket />}
            title="Onboarding not started"
            description='Use "Start Onboarding" above to schedule the kickoff.'
          />
        )}
      </div>
    </>
  );
}
