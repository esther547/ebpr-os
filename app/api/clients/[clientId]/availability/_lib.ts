import { z } from "zod";

const dateKey = z
  .string({ required_error: "La fecha es obligatoria" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (usa AAAA-MM-DD)")
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    // Rejects impossible days such as 2026-02-30 (JS would roll them over).
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Fecha inválida");

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Máximo ${max} caracteres`)
    .nullable()
    .optional()
    .transform((v) => (v == null ? v : v.trim() || null));

export const availabilityCreateSchema = z.object({
  kind: z.enum(["OFF", "TRAVEL"], { errorMap: () => ({ message: "Tipo inválido (OFF o TRAVEL)" }) }),
  startDate: dateKey,
  endDate: dateKey,
  location: optionalText(200),
  notes: optionalText(1000),
});

export const availabilityPatchSchema = availabilityCreateSchema.partial();

export function zodMessage(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("; ");
}

/** Cross-field rules shared by POST and PATCH (applied to the merged result). */
export function validateWindow(w: {
  kind: "OFF" | "TRAVEL";
  startDate: string;
  endDate: string;
  location?: string | null;
}): string | null {
  if (w.endDate < w.startDate) return "La fecha final debe ser igual o posterior a la inicial";
  if (w.kind === "TRAVEL" && !w.location?.trim()) return "Indica el lugar del viaje";
  return null;
}
