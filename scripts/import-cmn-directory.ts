/**
 * CMN (Cardenas Marketing Network) staff directory → Music Industry database.
 * The sheet lists offices in blocks: a header row "CMN <OFFICE> | DEPARTMENT | EXT | CELL PHONE | EMAIL ADDRESS"
 * followed by people. Existing contacts (by email) gain company/role/phone when blank and the tag.
 *   npx tsx scripts/import-cmn-directory.ts "<Contact List.xlsx>" [--apply]
 */
import * as XLSX from "xlsx";
import { db } from "../lib/db";
const TAG = "CMN staff";
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const title = (s: string) => s.toLowerCase().split(" ").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
(async () => {
  const [file] = process.argv.slice(2).filter((a) => !a.startsWith("--")); const apply = process.argv.includes("--apply");
  const wb = XLSX.readFile(file);
  type P = { name: string; email: string; role: string; phone: string; office: string };
  const people = new Map<string, P>(); let office = "";
  for (const sheet of wb.SheetNames) {
    const rows = (XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "" }) as unknown[][]).map((r) => r.map(clean));
    for (const r of rows) {
      // the directory may hold two blocks side by side (cols 0-4 and 5-9, …): scan every 5-column group
      for (let off = 0; off + 4 < Math.max(r.length, 5) + 4; off += 5) {
        const g = r.slice(off, off + 5); if (!g.some(Boolean)) continue;
        if (/^CMN /i.test(g[0]) && /department/i.test(g[1] ?? "")) { office = title(g[0].replace(/^CMN\s*/i, "")); continue; }
        const emailCell = g.find((c) => EMAIL.test(c)); if (!emailCell || !g[0] || EMAIL.test(g[0])) continue;
        const email = emailCell.match(EMAIL)![0].toLowerCase();
        if (!people.has(email)) people.set(email, { name: title(g[0]), email, role: g[1] && !/^\d+$/.test(g[1]) ? g[1] : "", phone: g.find((c) => /\(\d{3}\)|\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(c) && !EMAIL.test(c)) ?? "", office });
      }
    }
  }
  const byOffice = new Map<string, number>(); for (const p of people.values()) byOffice.set(p.office || "?", (byOffice.get(p.office || "?") ?? 0) + 1);
  console.log(`${people.size} personas: ${[...byOffice].map(([o, n]) => `${o} ${n}`).join(" · ")}`);
  for (const p of [...people.values()].slice(0, 6)) console.log(`   ${p.name} | ${p.role} | ${p.phone} | ${p.email} | ${p.office}`);
  let created = 0, updated = 0;
  for (const p of people.values()) {
    const ex = await db.outreachContact.findUnique({ where: { email: p.email }, select: { id: true, tags: true, company: true, role: true, phone: true, city: true } });
    const company = "CMN · Cardenas Marketing Network";
    if (ex) { updated++; if (apply) await db.outreachContact.update({ where: { id: ex.id }, data: { tags: ex.tags.includes(TAG) ? ex.tags : [...ex.tags, TAG], company: ex.company && !/^cmnevents$/i.test(ex.company) ? ex.company : company, role: ex.role || p.role || null, phone: ex.phone || p.phone || null, city: ex.city || p.office || null, isActive: true } }); }
    else { created++; if (apply) await db.outreachContact.create({ data: { list: "Music Industry", name: p.name, email: p.email, company, role: p.role || null, phone: p.phone || null, city: p.office || null, category: "CMN", tags: [TAG], source: "Contact List 09.22.26 (directorio CMN)" } }); }
  }
  console.log(`${created} nuevos, ${updated} ya existían (actualizados)${apply ? " · aplicado" : " · dry run"}`);
  await db.$disconnect();
})();
