/**
 * Copy researched contacts (compact one-liners) onto strategy items whose title matches a target.
 *   npx tsx scripts/apply-strategy-contacts.ts <contacts-compact.json> [--apply] [--overwrite]
 * Only fills items with no contact yet unless --overwrite. Source is recorded as AI (Claude research).
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const db = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const OVERWRITE = args.includes("--overwrite");
const file = args.find((a) => a.endsWith(".json"))!;

const RULES: [RegExp, string[]][] = [
  [/latin grammy/i, ["LATINGRAMMY"]],
  [/leading ladies/i, ["LEADINGLADIES"]],
  [/billboard latin|latin billboard|premios billboard/i, ["LATINBILLBOARD"]],
  [/billboard music awards/i, ["BBMA"]],
  [/eliot/i, ["ELIOT"]],
  [/amfar/i, ["AMFARLA"]],
  [/cfda/i, ["CFDA"]],
  [/academy museum/i, ["ACADEMYMUSEUM"]],
  [/governors/i, ["GOVERNORS"]],
  [/baby2baby/i, ["BABY2BABY"]],
  [/lacma/i, ["LACMA"]],
  [/glamour women/i, ["GLAMOURWOTY"]],
  [/dubai fashion/i, ["DUBAIFW"]],
  [/\bbof\b|business of fashion/i, ["BOF500"]],
  [/paris fashion week|fashion week par[ií]s/i, ["PFW"]],
  [/icono/i, ["ICONO"]],
  [/variety power/i, ["VARIETYPOW"]],
  [/wsj/i, ["WSJ"]],
  [/vogue forces/i, ["VOGUEFOF"]],
  [/vogue m[ée]xico|gala vogue/i, ["VOGUEGALA"]],
  [/emily in paris/i, ["EMILYINPARIS"]],
  [/inter miami/i, ["INTERMIAMI"]],
  [/don francisco/i, ["DONFRANCISCO"]],
  [/premios heat|heat latin/i, ["HEAT_MOLY"]],
  [/rolling stone/i, ["RS_MOLY"]],
  [/victoria'?s secret/i, ["VSSHOW"]],
  [/tiffany/i, ["TIFFANY"]],
  [/despierta am[ée]rica|hoy d[ií]a|al rojo vivo/i, ["UNIVISION_DANIFER"]],
  [/\bcnn\b/i, ["CNN_DANIFER"]],
  [/hann?ah? stocking/i, ["HANNAHSTOCKING"]],
  [/bisbal/i, ["BISBAL"]],
  [/tom[áa]s palacios/i, ["TOMASPALACIOS"]],
  [/colombiamoda|colombia moda/i, ["COLOMBIAMODA"]],
  [/premieres/i, ["PREMIERES"]],
  [/eva longoria/i, ["EVALONGORIA"]],
  [/mr\.? ?chow/i, ["MRCHOW"]],
  [/primer impacto/i, ["PRIMERIMPACTO"]],
  [/galore/i, ["GALORE"]],
  [/^paper( mag(azine)?)?$/i, ["PAPER"]],
  [/sof[ií]a reyes/i, ["SOFIAREYES"]],
  [/french toast/i, ["FRENCHTOAST"]],
  [/ton+y rocks/i, ["TONNYROCKS"]],
  [/sports illustrated/i, ["SI_GRACIE"]],
  [/gq men of the year|^gq$/i, ["GQMEN", "GQMEN_USA"]],
  [/mundial femenino|women'?s world cup/i, ["NETFLIX_WWC"]],
];

async function main() {
  const c: Record<string, { target: string; lines: string[] }> = JSON.parse(readFileSync(file, "utf8"));
  const items = await db.strategyItem.findMany({
    where: { client: { status: "ACTIVE" } },
    select: { id: true, title: true, contactNotes: true, client: { select: { name: true } } },
  });
  let done = 0;
  for (const it of items) {
    const ids = RULES.filter(([re]) => re.test(it.title)).flatMap(([, ids]) => ids);
    if (!ids.length) continue;
    if (it.contactNotes && !OVERWRITE) continue;
    const uniq = [...new Set(ids)];
    const notes = uniq.length === 1 ? c[uniq[0]].lines.join("\n") : uniq.map((i) => `${c[i].target}:\n${c[i].lines.join("\n")}`).join("\n");
    console.log(`  ✓ [${it.client.name}] ${it.title}  ← ${uniq.join(",")}`);
    if (APPLY) await db.strategyItem.update({ where: { id: it.id }, data: { contactNotes: notes, contactSource: "AI", contactUpdatedAt: new Date() } });
    done++;
  }
  console.log(`\n${done} items. ${APPLY ? "Applied." : "Dry run."}`);
}
main().finally(() => db.$disconnect());
