import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { formatDate, cn } from "@/lib/utils";

type Props = { params: { clientId: string } };

export const metadata = { title: "Onboarding" };

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
    select: { id: true, name: true },
  });
  if (!client) notFound();

  const onboarding = await db.onboarding.findUnique({
    where: { clientId: params.clientId },
    include: { checklistItems: { orderBy: { order: "asc" } } },
  });

  const currentStepIdx = onboarding
    ? STATUS_STEPS.findIndex((s) => s.key === onboarding.status)
    : 0;

  return (
    <>
      <PageHeader
        title="Onboarding"
        subtitle={`${client.name} · Preparation & kickoff`}
      />

      {/* Progress stepper */}
      <div className="mb-8 rounded-lg border border-border bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-primary">
          Onboarding Progress
        </h2>
        <div className="flex items-center gap-0">
          {STATUS_STEPS.map((step, i) => {
            const isDone = i < currentStepIdx;
            const isCurrent = i === currentStepIdx;

            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors",
                      isDone
                        ? "border-ink-primary bg-ink-primary text-ink-inverted"
                        : isCurrent
                        ? "border-ink-primary bg-white text-ink-primary"
                        : "border-border bg-white text-ink-muted"
                    )}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 text-center text-2xs leading-tight max-w-[72px]",
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
                      "h-0.5 flex-1 mx-1 mb-5 transition-colors",
                      i < currentStepIdx ? "bg-ink-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {onboarding ? (
        <div className="grid grid-cols-2 gap-6">
          {/* Kickoff notes */}
          <section className="rounded-lg border border-border bg-white p-6">
            <h2 className="mb-4 font-semibold text-ink-primary">
              Kickoff Meeting
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-ink-muted">Date</dt>
                <dd className="font-medium text-ink-primary">
                  {formatDate(onboarding.kickoffDate)}
                </dd>
              </div>
              {onboarding.narrative && (
                <div>
                  <dt className="text-ink-muted mb-1">Narrative</dt>
                  <dd className="text-ink-secondary">{onboarding.narrative}</dd>
                </div>
              )}
              {onboarding.brandPositioning && (
                <div>
                  <dt className="text-ink-muted mb-1">Brand Positioning</dt>
                  <dd className="text-ink-secondary">
                    {onboarding.brandPositioning}
                  </dd>
                </div>
              )}
              {onboarding.vision && (
                <div>
                  <dt className="text-ink-muted mb-1">Vision</dt>
                  <dd className="text-ink-secondary">{onboarding.vision}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Questionnaire */}
          <section className="rounded-lg border border-border bg-white p-6">
            <h2 className="mb-4 font-semibold text-ink-primary">
              Questionnaire
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-ink-muted">Sent</dt>
                <dd className="font-medium text-ink-primary">
                  {formatDate(onboarding.questionnaireSentAt)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Received</dt>
                <dd className="font-medium text-ink-primary">
                  {formatDate(onboarding.questionnaireCompletedAt)}
                </dd>
              </div>
            </dl>
            {onboarding.questionnaireResponses && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
                  Responses
                </p>
                <div className="rounded-md bg-surface-2 p-3 text-xs text-ink-secondary font-mono overflow-auto max-h-40">
                  {JSON.stringify(onboarding.questionnaireResponses, null, 2)}
                </div>
              </div>
            )}
          </section>

          {/* Checklist */}
          {onboarding.checklistItems.length > 0 && (
            <section className="col-span-2 rounded-lg border border-border bg-white p-6">
              <h2 className="mb-4 font-semibold text-ink-primary">
                Onboarding Checklist
              </h2>
              <ul className="space-y-2">
                {onboarding.checklistItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center flex-shrink-0",
                        item.completed
                          ? "bg-ink-primary border-ink-primary"
                          : "border-border"
                      )}
                    >
                      {item.completed && (
                        <svg
                          className="h-2.5 w-2.5 text-white"
                          viewBox="0 0 10 10"
                          fill="none"
                        >
                          <path
                            d="M1.5 5L4 7.5L8.5 2.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span
                      className={cn(
                        item.completed
                          ? "line-through text-ink-muted"
                          : "text-ink-primary"
                      )}
                    >
                      {item.label}
                    </span>
                    {item.completedAt && (
                      <span className="text-xs text-ink-muted ml-auto">
                        {formatDate(item.completedAt)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
          <p className="text-sm font-medium text-ink-primary">
            Onboarding not started
          </p>
          <button className="mt-4 inline-flex h-9 items-center rounded-md bg-ink-primary px-4 text-sm font-medium text-ink-inverted hover:bg-ink-primary/90 transition-colors">
            Start Onboarding
          </button>
        </div>
      )}
    </>
  );
}
