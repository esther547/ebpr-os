import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizePriorities, isValidDayKey, resolveWeekKey, setClientOrder } from "@/lib/priorities";

const schema = z.object({
  week: z.string().refine(isValidDayKey, "Semana inválida"),
  clientIds: z.array(z.string().min(1)).max(500),
});

/** PUT — save the manual client order of Prioridades for a week (most urgent first). Admin only. */
export async function PUT(req: NextRequest) {
  const auth = await authorizePriorities("TEAM");
  if (auth.error) return auth.error;
  if (auth.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Solo Esther ordena los clientes" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const clientIds = [...new Set(parsed.data.clientIds)];
  await setClientOrder(resolveWeekKey(parsed.data.week), clientIds);
  return NextResponse.json({ data: { clientIds } });
}
