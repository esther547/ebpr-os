"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Search, Upload, Plus, Pencil, Trash2, Users, CheckCircle2 } from "lucide-react";
import { TIERS, TIER_LABELS, type Tier } from "@/lib/talent-tiers";

export type TalentRow = { id: string; ebmId: string | null; name: string; tier: string; source: string | null; type: string | null; country: string | null; location: string | null; age: number | null; languages: string[]; verticals: string[]; instagramHandle: string | null; instagramUrl: string | null; instagramFollowers: number | null; tiktokHandle: string | null; tiktokUrl: string | null; tiktokFollowers: number | null; youtubeHandle: string | null; youtubeFollowers: number | null; totalReach: number | null; pastBrands: string[]; notes: string | null; lastVerifiedAt: string | null };

const TIER_TONE: Record<string, BadgeTone> = { RETAINER: "success", OFF_RETAINER: "warning", ACCESS: "info", UNSET: "neutral" };
const fmt = (n: number | null) => (n === null ? null : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
const verified = (iso: string | null) => (iso ? `verificado ${new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" })}` : "sin verificar");
async function readError(res: Response, fallback: string) { try { const d = await res.json(); return typeof d.error === "string" ? d.error : fallback; } catch { return fallback; } }

export function TalentsClient({ talents }: { talents: TalentRow[] }) {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [country, setCountry] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<TalentRow | null>(null);
  const [removing, setRemoving] = useState<TalentRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const countries = useMemo(() => Array.from(new Set(talents.map((t) => t.country).filter((c): c is string => !!c))).sort(), [talents]);
  const q = search.trim().toLowerCase();
  const rows = talents.filter((t) => (!tier || t.tier === tier) && (!country || t.country === country) && (!q || [t.name, t.instagramHandle, t.tiktokHandle, t.location, t.country, t.type, ...t.verticals, ...t.pastBrands].some((v) => v?.toLowerCase().includes(q))));
  const counts = TIERS.reduce((acc, k) => ({ ...acc, [k]: talents.filter((t) => t.tier === k).length }), {} as Record<Tier, number>);

  async function patch(t: TalentRow, body: Record<string, unknown>, okTitle: string) {
    setBusyId(t.id);
    const res = await fetch(`/api/talents/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusyId(null);
    if (!res || !res.ok) { toast({ title: "No se pudo guardar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return; }
    toast({ title: okTitle, variant: "success" }); router.refresh();
  }
  async function remove(t: TalentRow) {
    const res = await fetch(`/api/talents/${t.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) { toast({ title: "No se pudo quitar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return false; }
    toast({ title: `${t.name} quitado del roster`, variant: "success" }); router.refresh(); return true;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, @handle, vertical, marca, ciudad…" className="pl-9" /></div>
        <Select value={tier} onChange={(e) => setTier(e.target.value)} className="w-auto"><option value="">Todos los estados</option>{TIERS.map((k) => <option key={k} value={k}>{TIER_LABELS[k]} ({counts[k]})</option>)}</Select>
        <Select value={country} onChange={(e) => setCountry(e.target.value)} className="w-auto"><option value="">Todos los países</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        <Button variant="secondary" onClick={() => setShowImport(true)}><Upload className="h-4 w-4" /> Importar</Button>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Agregar talento</Button>
      </div>
      <p className="text-xs text-ink-muted">{rows.length} de {talents.length} talentos. Los seguidores muestran cuándo se verificaron por última vez; verifica en el perfil antes de citarlos a una marca.</p>
      {rows.length === 0 ? <EmptyState icon={<Users />} title="Sin talentos" description="Importa el roster de EBM o agrega uno a mano." /> : (
        <TableWrap>
          <Table>
            <thead><tr><Th>Talento</Th><Th>Estado</Th><Th>Mercado</Th><Th>Verticales</Th><Th align="right">Instagram</Th><Th align="right">TikTok</Th><Th align="right">YouTube</Th><Th>Marcas</Th><Th></Th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="align-top">
                  <Td><div className="font-medium">{t.name}</div><div className="text-xs text-ink-muted">{[t.type, t.age ? `${t.age} años` : null, t.languages.join("/")].filter(Boolean).join(" · ")}</div>{t.notes && <div className="mt-1 max-w-xs text-[11px] text-ink-muted line-clamp-2" title={t.notes}>{t.notes}</div>}</Td>
                  <Td><Select value={t.tier} disabled={busyId === t.id} onChange={(e) => patch(t, { tier: e.target.value }, `${t.name}: ${TIER_LABELS[e.target.value as Tier]}`)} className="h-8 w-auto text-xs">{TIERS.map((k) => <option key={k} value={k}>{TIER_LABELS[k]}</option>)}</Select></Td>
                  <Td><div className="text-sm">{t.country ?? <span className="text-ink-muted">—</span>}</div>{t.location && <div className="text-xs text-ink-muted">{t.location}</div>}</Td>
                  <Td><div className="flex max-w-[200px] flex-wrap gap-1">{t.verticals.map((v) => <Badge key={v} tone="outline">{v}</Badge>)}</div></Td>
                  <Td align="right" numeric>{t.instagramHandle ? <><a href={t.instagramUrl ?? `https://instagram.com/${t.instagramHandle.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="text-xs text-ink-secondary underline">@{t.instagramHandle.replace(/^@/, "")}</a><div className="font-medium">{fmt(t.instagramFollowers) ?? <span className="text-xs font-normal text-ink-muted">sin cifra</span>}</div>{t.instagramFollowers !== null && <div className="text-[10px] text-ink-muted">{verified(t.lastVerifiedAt)}</div>}</> : <span className="text-ink-muted">—</span>}</Td>
                  <Td align="right" numeric>{t.tiktokHandle ? <><a href={t.tiktokUrl ?? `https://tiktok.com/@${t.tiktokHandle.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="text-xs text-ink-secondary underline">@{t.tiktokHandle.replace(/^@/, "")}</a><div className="font-medium">{fmt(t.tiktokFollowers) ?? <span className="text-xs font-normal text-ink-muted">sin cifra</span>}</div>{t.tiktokFollowers !== null && <div className="text-[10px] text-ink-muted">{verified(t.lastVerifiedAt)}</div>}</> : <span className="text-ink-muted">—</span>}</Td>
                  <Td align="right" numeric>{t.youtubeHandle || t.youtubeFollowers !== null ? <><div className="text-xs text-ink-secondary">{t.youtubeHandle ?? ""}</div><div className="font-medium">{fmt(t.youtubeFollowers) ?? <span className="text-xs font-normal text-ink-muted">sin cifra</span>}</div></> : <span className="text-ink-muted">—</span>}</Td>
                  <Td><div className="max-w-[220px] text-xs text-ink-secondary line-clamp-3" title={t.pastBrands.join(", ")}>{t.pastBrands.join(", ") || <span className="text-ink-muted">—</span>}</div></Td>
                  <Td><div className="flex gap-1">
                    <button title="Marcar cifras como verificadas hoy" disabled={busyId === t.id} onClick={() => patch(t, { verifiedNow: true }, `${t.name}: cifras verificadas hoy`)} className="rounded p-1 text-ink-muted hover:bg-surface-muted hover:text-green-700"><CheckCircle2 className="h-4 w-4" /></button>
                    <button title="Editar" onClick={() => setEditing(t)} className="rounded p-1 text-ink-muted hover:bg-surface-muted hover:text-ink-primary"><Pencil className="h-4 w-4" /></button>
                    <button title="Quitar del roster" onClick={() => setRemoving(t)} className="rounded p-1 text-ink-muted hover:bg-surface-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <TalentModal open={showAdd || !!editing} onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditing(null); } }} talent={editing} onSaved={() => { setShowAdd(false); setEditing(null); router.refresh(); }} />
      <ImportModal open={showImport} onOpenChange={setShowImport} onDone={() => { setShowImport(false); router.refresh(); }} />
      <ConfirmModal open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }} title="Quitar del roster" description={removing ? `${removing.name} deja de aparecer en el roster y en las propuestas. No se borra la ficha.` : ""} confirmLabel="Quitar" onConfirm={async () => { if (removing && (await remove(removing))) setRemoving(null); }} />
    </div>
  );
}

function TalentModal({ open, onOpenChange, talent, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; talent: TalentRow | null; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const isEdit = !!talent;
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const g = (k: string) => (fd.get(k) as string | null)?.trim() || null;
    const body = { name: g("name"), tier: g("tier") ?? "UNSET", type: g("type"), country: g("country"), location: g("location"), age: g("age"), languages: g("languages"), verticals: g("verticals"), instagramHandle: g("instagramHandle"), instagramFollowers: g("instagramFollowers"), tiktokHandle: g("tiktokHandle"), tiktokFollowers: g("tiktokFollowers"), youtubeHandle: g("youtubeHandle"), youtubeFollowers: g("youtubeFollowers"), pastBrands: g("pastBrands"), notes: g("notes"), lastVerifiedAt: g("lastVerifiedAt") };
    setSaving(true);
    const res = await fetch(isEdit ? `/api/talents/${talent!.id}` : "/api/talents", { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) { toast({ title: isEdit ? "No se pudo guardar" : "No se pudo agregar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return; }
    toast({ title: isEdit ? "Talento actualizado" : "Talento agregado", variant: "success" }); onSaved();
  }
  const t = talent;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={isEdit ? "Editar talento" : "Agregar talento"} description={isEdit ? `Editando a ${t!.name}` : "Si ya existe (mismo nombre o mismo Instagram) el sistema lo avisa en vez de duplicarlo."} size="lg">
      <form key={t?.id ?? "new"} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormGroup label="Nombre" htmlFor="t-name" required className="sm:col-span-2"><Input id="t-name" name="name" defaultValue={t?.name} required autoFocus /></FormGroup>
          <FormGroup label="Estado" htmlFor="t-tier"><Select id="t-tier" name="tier" defaultValue={t?.tier ?? "UNSET"}>{TIERS.map((k) => <option key={k} value={k}>{TIER_LABELS[k]}</option>)}</Select></FormGroup>
          <FormGroup label="Tipo" htmlFor="t-type" hint="social, influencer, artist, actor…"><Input id="t-type" name="type" defaultValue={t?.type ?? ""} /></FormGroup>
          <FormGroup label="País" htmlFor="t-country"><Input id="t-country" name="country" defaultValue={t?.country ?? ""} /></FormGroup>
          <FormGroup label="Ciudad" htmlFor="t-location"><Input id="t-location" name="location" defaultValue={t?.location ?? ""} /></FormGroup>
          <FormGroup label="Edad" htmlFor="t-age"><Input id="t-age" name="age" type="number" min={0} defaultValue={t?.age ?? ""} /></FormGroup>
          <FormGroup label="Idiomas" htmlFor="t-languages" hint="separados por coma"><Input id="t-languages" name="languages" defaultValue={t?.languages.join(", ") ?? ""} /></FormGroup>
          <FormGroup label="Verticales" htmlFor="t-verticals" hint="beauty, lifestyle, music…"><Input id="t-verticals" name="verticals" defaultValue={t?.verticals.join(", ") ?? ""} /></FormGroup>
          <FormGroup label="Instagram" htmlFor="t-ig"><Input id="t-ig" name="instagramHandle" placeholder="@handle" defaultValue={t?.instagramHandle ?? ""} /></FormGroup>
          <FormGroup label="Seguidores IG" htmlFor="t-igf"><Input id="t-igf" name="instagramFollowers" type="number" min={0} defaultValue={t?.instagramFollowers ?? ""} /></FormGroup>
          <FormGroup label="Verificado el" htmlFor="t-ver" hint="fecha en que se revisaron las cifras"><Input id="t-ver" name="lastVerifiedAt" type="date" defaultValue={t?.lastVerifiedAt ? t.lastVerifiedAt.slice(0, 10) : ""} /></FormGroup>
          <FormGroup label="TikTok" htmlFor="t-tt"><Input id="t-tt" name="tiktokHandle" placeholder="@handle" defaultValue={t?.tiktokHandle ?? ""} /></FormGroup>
          <FormGroup label="Seguidores TikTok" htmlFor="t-ttf"><Input id="t-ttf" name="tiktokFollowers" type="number" min={0} defaultValue={t?.tiktokFollowers ?? ""} /></FormGroup>
          <div />
          <FormGroup label="YouTube" htmlFor="t-yt"><Input id="t-yt" name="youtubeHandle" defaultValue={t?.youtubeHandle ?? ""} /></FormGroup>
          <FormGroup label="Suscriptores YouTube" htmlFor="t-ytf"><Input id="t-ytf" name="youtubeFollowers" type="number" min={0} defaultValue={t?.youtubeFollowers ?? ""} /></FormGroup>
        </div>
        <FormGroup label="Marcas con las que ha trabajado" htmlFor="t-brands" hint="separadas por coma"><Input id="t-brands" name="pastBrands" defaultValue={t?.pastBrands.join(", ") ?? ""} /></FormGroup>
        <FormGroup label="Notas" htmlFor="t-notes" hint="de dónde salen las cifras, rangos en conflicto, lo que valga la pena saber"><Textarea id="t-notes" name="notes" rows={3} defaultValue={t?.notes ?? ""} /></FormGroup>
        <FormActions><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando…" : isEdit ? "Guardar" : "Agregar"}</Button></FormActions>
      </form>
    </Modal>
  );
}

/** Tiny CSV parser (quoted fields, commas or semicolons). */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const split = (line: string) => { const out: string[] = []; let cur = ""; let inQ = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (inQ) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch; } else if (ch === '"') inQ = true; else if (ch === sep) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()); };
  const headers = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const ALIAS: Record<string, string> = { nombre: "name", talento: "name", talent: "name", name: "name", estado: "tier", tier: "tier", status: "tier", tipo: "type", type: "type", pais: "country", country: "country", ciudad: "location", location: "location", city: "location", edad: "age", age: "age", idiomas: "languages", languages: "languages", verticales: "verticals", verticals: "verticals", categoria: "verticals", instagram: "instagramHandle", instagramhandle: "instagramHandle", ig: "instagramHandle", instagramfollowers: "instagramFollowers", seguidoresig: "instagramFollowers", seguidoresinstagram: "instagramFollowers", instagramurl: "instagramUrl", tiktok: "tiktokHandle", tiktokhandle: "tiktokHandle", tiktokfollowers: "tiktokFollowers", seguidorestiktok: "tiktokFollowers", tiktokurl: "tiktokUrl", youtube: "youtubeHandle", youtubehandle: "youtubeHandle", youtubefollowers: "youtubeFollowers", totalreach: "totalReach", alcance: "totalReach", marcas: "pastBrands", pastbrands: "pastBrands", brands: "pastBrands", notas: "notes", notes: "notes", ebmid: "ebmId", id: "ebmId" };
  return lines.slice(1).map((l) => { const vals = split(l); const r: Record<string, string> = {}; headers.forEach((h, i) => { const k = ALIAS[h]; if (k && vals[i]) r[k] = vals[i]; }); return r; });
}
const TIER_ALIAS: Record<string, string> = { retainer: "RETAINER", "en retainer": "RETAINER", "on retainer": "RETAINER", "off retainer": "OFF_RETAINER", "fuera de retainer": "OFF_RETAINER", "sin retainer": "OFF_RETAINER", access: "ACCESS", acceso: "ACCESS", "brand deals": "ACCESS" };

function ImportModal({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("EBPR");
  const [preview, setPreview] = useState<{ total: number; wouldCreate: number; wouldMerge: number; duplicates: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  function parseRows(): Record<string, unknown>[] | null {
    const raw = text.trim(); if (!raw) return null;
    try { const j = JSON.parse(raw); const arr = Array.isArray(j) ? j : Array.isArray(j.talents) ? j.talents : null; if (arr) return arr; } catch { /* not JSON */ }
    const rows = parseCsv(raw).map((r) => { const t = r.tier ? TIER_ALIAS[r.tier.toLowerCase()] ?? (TIERS as readonly string[]).includes(r.tier.toUpperCase()) ? r.tier.toUpperCase() : undefined : undefined; return { ...r, tier: t, languages: r.languages?.split(/[,/;]/), verticals: r.verticals?.split(/[,/;]/), pastBrands: r.pastBrands?.split(/[,;]/), age: r.age ? Number(r.age) : null, instagramFollowers: r.instagramFollowers ? Number(r.instagramFollowers.replace(/[^\d]/g, "")) : null, tiktokFollowers: r.tiktokFollowers ? Number(r.tiktokFollowers.replace(/[^\d]/g, "")) : null, youtubeFollowers: r.youtubeFollowers ? Number(r.youtubeFollowers.replace(/[^\d]/g, "")) : null, totalReach: r.totalReach ? Number(r.totalReach.replace(/[^\d]/g, "")) : null }; });
    return rows.length ? rows : null;
  }
  async function run(dryRun: boolean) {
    const rows = parseRows();
    if (!rows) { toast({ title: "No encontré filas", description: "Pega el JSON del roster o un CSV con encabezados (nombre, estado, país, instagram, seguidores…).", variant: "error" }); return; }
    setBusy(true);
    const res = await fetch("/api/talents/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, source, dryRun }) }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) { toast({ title: "No se pudo importar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return; }
    const data = await res.json();
    if (dryRun) { setPreview(data); return; }
    toast({ title: `Importados ${data.created} nuevos`, description: data.merged ? `${data.merged} ya existían y se completaron sin duplicar.` : undefined, variant: "success" });
    setText(""); setPreview(null); onDone();
  }
  return (
    <Modal open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPreview(null); }} title="Importar talentos" description="Pega el JSON exportado de EBM o un CSV con encabezados. Los que ya existen (mismo ID de EBM, mismo Instagram o mismo nombre) se completan, nunca se duplican." size="lg">
      <div className="space-y-4">
        <Textarea rows={10} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} placeholder={'[{"name":"…","country":"Mexico","instagramHandle":"…"}]\n— o —\nnombre, estado, país, ciudad, instagram, seguidores ig, verticales, marcas\n…'} className="font-mono text-xs" />
        <FormGroup label="Fuente" htmlFor="imp-src" hint="queda guardada en cada talento"><Input id="imp-src" value={source} onChange={(e) => setSource(e.target.value)} /></FormGroup>
        {preview && <div className="rounded-md bg-surface-muted p-3 text-sm"><p><strong>{preview.total}</strong> filas: {preview.wouldCreate} nuevas, {preview.wouldMerge} ya existen.</p>{preview.duplicates.length > 0 && <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5 text-xs text-ink-secondary">{preview.duplicates.map((d) => <li key={d}>{d}</li>)}</ul>}</div>}
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => run(true)} disabled={busy || !text.trim()}>Revisar duplicados</Button>
          <Button type="button" onClick={() => run(false)} disabled={busy || !text.trim()}>{busy ? "Importando…" : "Importar"}</Button>
        </FormActions>
      </div>
    </Modal>
  );
}
