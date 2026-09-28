const XLSX = require("xlsx"); const fs = require("fs"); const path = require("path");
const root = process.argv[2];
function walk(d){ return fs.readdirSync(d).flatMap(f=>{const p=path.join(d,f); return fs.statSync(p).isDirectory()?walk(p):[p];}); }
for (const f of walk(root).filter(f=>f.endsWith(".xlsx")).sort()) {
  const wb = XLSX.readFile(f, { cellDates: false });
  const rel = path.relative(root, f);
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
    const nonEmpty = rows.filter(r => r.some(c => String(c).trim()));
    if (!nonEmpty.length) continue;
    // header = first row with >=2 non-empty cells
    const hi = nonEmpty.findIndex(r => r.filter(c=>String(c).trim()).length >= 2);
    const header = (nonEmpty[hi] || []).map(c => String(c).trim()).filter(Boolean).slice(0, 12);
    const emails = nonEmpty.flat().filter(c => /\S+@\S+\.\S+/.test(String(c))).length;
    console.log(`${rel} :: ${name} :: rows=${nonEmpty.length - hi - 1} emails=${emails} :: ${header.join(" | ")}`);
  }
}
