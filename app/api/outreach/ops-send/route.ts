import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { authorizeCron, NO_STORE } from "@/lib/cron-auth";
import { invitationHtml, sendOutreach, type Flyer } from "@/lib/outreach";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** Mass mode: send to the outreach database (filters below) instead of `to`. */
  mass: z.boolean().optional().default(false),
  categories: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  excludeTags: z.array(z.string()).optional().default([]),
  includeMedios: z.boolean().optional().default(false),
  to: z.array(z.string().email()).max(20).optional().default([]),
  cc: z.array(z.string().email()).max(20).optional(),
  replyTo: z.string().email().optional(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  fromName: z.string().max(120).optional(),
  header: z.string().max(120).optional(),
  footer: z.string().max(300).optional(),
  /** A file under /public (e.g. "invites/off-the-record-2026.jpg") embedded at the top of the email. */
  flyerPath: z.string().max(200).optional(),
});

/** Operator send (CRON_SECRET or super admin): one invitation to specific addresses, e.g. a test for the client. */
export async function POST(req: NextRequest) {
  const denied = await authorizeCron(req);
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  const d = parsed.data;
  let flyer: Flyer | null = null;
  if (d.flyerPath) {
    const safe = d.flyerPath.replace(/^\/+/, "").replace(/\.\./g, "");
    try {
      const content = await readFile(path.join(process.cwd(), "public", safe));
      flyer = { filename: path.basename(safe), content, contentType: /\.png$/i.test(safe) ? "image/png" : "image/jpeg" };
    } catch {
      const res = await fetch(new URL(`/${safe}`, req.nextUrl.origin));
      if (res.ok) flyer = { filename: path.basename(safe), content: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "image/jpeg" };
    }
  }
  if (d.mass) {
    const esther = await db.user.findFirst({ where: { email: "esther@ebmanagement.io" }, select: { id: true } });
    const result = await sendOutreach({ subject: d.subject, body: d.body, categories: d.categories, tags: d.tags, excludeTags: d.excludeTags, includeMedios: d.includeMedios, flyer, brand: { fromName: d.fromName, header: d.header, footer: d.footer }, replyTo: d.replyTo, sentById: esther?.id });
    return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: NO_STORE });
  }
  if (!d.to.length) return NextResponse.json({ error: "to is required" }, { status: 400 });
  const ok = await sendEmail({
    to: d.to, cc: d.cc, replyTo: d.replyTo, fromName: d.fromName, subject: d.subject,
    html: invitationHtml(d.subject, d.body, flyer, { header: d.header, footer: d.footer }),
    text: d.body,
    attachments: flyer ? [{ ...flyer, cid: "flyer" }] : undefined,
  });
  return NextResponse.json({ ok, flyer: !!flyer }, { status: ok ? 200 : 400, headers: NO_STORE });
}
