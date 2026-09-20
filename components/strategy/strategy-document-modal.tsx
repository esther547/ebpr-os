"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Textarea, FormGroup, FormActions, type ButtonProps } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";

export type StrategyDocFormValues = {
  objective: string | null;
  strategicPath: string | null;
  messagingFramework: string | null;
  clientPersona: string | null;
  targetAudience: string | null;
  executionNotes: string | null;
  keyMessages: unknown;
  location: string | null;
  year: number | null;
  prepMonthStart: string | Date | null;
  prepMonthEnd: string | Date | null;
  campaignStart: string | Date | null;
  phase1Name: string | null;
  phase1Start: string | Date | null;
  phase1End: string | Date | null;
  phase2Name: string | null;
  phase2Start: string | Date | null;
  phase2End: string | Date | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  doc: StrategyDocFormValues | null;
}

function dateValue(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function StrategyDocumentModal({ open, onOpenChange, clientId, doc }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const keyMessages = Array.isArray(doc?.keyMessages) ? (doc!.keyMessages as string[]) : [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const text = (name: string) => ((form.get(name) as string) ?? "").trim();
    const date = (name: string) => text(name) || null;
    const yearRaw = text("year");

    const body = {
      objective: text("objective"),
      strategicPath: text("strategicPath"),
      messagingFramework: text("messagingFramework"),
      clientPersona: text("clientPersona"),
      targetAudience: text("targetAudience"),
      executionNotes: text("executionNotes"),
      keyMessages: text("keyMessages").split("\n").map((l) => l.trim()).filter(Boolean),
      location: text("location"),
      ...(yearRaw ? { year: parseInt(yearRaw, 10) } : {}),
      prepMonthStart: date("prepMonthStart"),
      prepMonthEnd: date("prepMonthEnd"),
      campaignStart: date("campaignStart"),
      phase1Name: text("phase1Name"),
      phase1Start: date("phase1Start"),
      phase1End: date("phase1End"),
      phase2Name: text("phase2Name"),
      phase2Start: date("phase2Start"),
      phase2End: date("phase2End"),
    };

    try {
      const res = await fetch(`/api/clients/${clientId}/strategy/document`, {
        method: "POST", // upsert
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Failed to save strategy brief",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "error",
        });
        setLoading(false);
        return;
      }
      setLoading(false);
      onOpenChange(false);
      toast({ title: "Strategy brief saved", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Network error", description: "Could not reach the server", variant: "error" });
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={doc ? "Edit Strategy Brief" : "Create Strategy Brief"}
      description="Objective, messaging, and phase structure for this client"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Objetivo" htmlFor="sd-objective">
            <Textarea id="sd-objective" name="objective" rows={3} defaultValue={doc?.objective ?? ""} />
          </FormGroup>
          <FormGroup label="Camino Estratégico" htmlFor="sd-path">
            <Textarea id="sd-path" name="strategicPath" rows={3} defaultValue={doc?.strategicPath ?? ""} />
          </FormGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Messaging" htmlFor="sd-messaging">
            <Textarea id="sd-messaging" name="messagingFramework" rows={2} defaultValue={doc?.messagingFramework ?? ""} />
          </FormGroup>
          <FormGroup label="Personaje" htmlFor="sd-persona">
            <Textarea id="sd-persona" name="clientPersona" rows={2} defaultValue={doc?.clientPersona ?? ""} />
          </FormGroup>
        </div>

        <FormGroup label="Key Messages (one per line)" htmlFor="sd-keymsgs">
          <Textarea id="sd-keymsgs" name="keyMessages" rows={3} defaultValue={keyMessages.join("\n")} />
        </FormGroup>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormGroup label="Fanbase / Audience" htmlFor="sd-audience">
            <Input id="sd-audience" name="targetAudience" defaultValue={doc?.targetAudience ?? ""} />
          </FormGroup>
          <FormGroup label="Location" htmlFor="sd-location">
            <Input id="sd-location" name="location" defaultValue={doc?.location ?? ""} placeholder="Miami, FL" />
          </FormGroup>
          <FormGroup label="Year" htmlFor="sd-year">
            <Input id="sd-year" name="year" type="number" min={2020} max={2100} defaultValue={doc?.year ?? ""} />
          </FormGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormGroup label="Prep Month Start" htmlFor="sd-prep-start">
            <Input id="sd-prep-start" name="prepMonthStart" type="date" defaultValue={dateValue(doc?.prepMonthStart)} />
          </FormGroup>
          <FormGroup label="Prep Month End" htmlFor="sd-prep-end">
            <Input id="sd-prep-end" name="prepMonthEnd" type="date" defaultValue={dateValue(doc?.prepMonthEnd)} />
          </FormGroup>
          <FormGroup label="Campaign Start" htmlFor="sd-camp-start">
            <Input id="sd-camp-start" name="campaignStart" type="date" defaultValue={dateValue(doc?.campaignStart)} />
          </FormGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-border p-3">
            <FormGroup label="Phase 1 Name" htmlFor="sd-p1">
              <Input id="sd-p1" name="phase1Name" defaultValue={doc?.phase1Name ?? ""} />
            </FormGroup>
            <div className="grid grid-cols-2 gap-3">
              <FormGroup label="Start" htmlFor="sd-p1s">
                <Input id="sd-p1s" name="phase1Start" type="date" defaultValue={dateValue(doc?.phase1Start)} />
              </FormGroup>
              <FormGroup label="End" htmlFor="sd-p1e">
                <Input id="sd-p1e" name="phase1End" type="date" defaultValue={dateValue(doc?.phase1End)} />
              </FormGroup>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-border p-3">
            <FormGroup label="Phase 2 Name" htmlFor="sd-p2">
              <Input id="sd-p2" name="phase2Name" defaultValue={doc?.phase2Name ?? ""} />
            </FormGroup>
            <div className="grid grid-cols-2 gap-3">
              <FormGroup label="Start" htmlFor="sd-p2s">
                <Input id="sd-p2s" name="phase2Start" type="date" defaultValue={dateValue(doc?.phase2Start)} />
              </FormGroup>
              <FormGroup label="End" htmlFor="sd-p2e">
                <Input id="sd-p2e" name="phase2End" type="date" defaultValue={dateValue(doc?.phase2End)} />
              </FormGroup>
            </div>
          </div>
        </div>

        <FormGroup label="Execution Notes" htmlFor="sd-exec">
          <Textarea id="sd-exec" name="executionNotes" rows={3} defaultValue={doc?.executionNotes ?? ""} />
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {doc ? "Save Changes" : "Create Brief"}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}

/** Button that opens the brief editor; used both in the empty state and on the document card. */
export function StrategyDocumentEditButton({
  clientId,
  doc,
  className,
  children,
  variant = "secondary",
  size = "sm",
}: {
  clientId: string;
  doc: StrategyDocFormValues | null;
  className?: string;
  children: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <StrategyDocumentModal open={open} onOpenChange={setOpen} clientId={clientId} doc={doc} />
    </>
  );
}
