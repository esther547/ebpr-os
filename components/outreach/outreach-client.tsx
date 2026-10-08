"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { DropdownMenu, DropdownMenuDots, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Search, Upload, Plus, Pencil, Trash2, Users, ChevronLeft, ChevronRight, Send, Mail } from "lucide-react";

type Contact = { id: string; name: string; email: string | null; company: string | null; role: string | null; category: string | null; phone: string | null; city: string | null; country: string | null; notes: string | null; tags: string[]; isActive: boolean };
type Category = { name: string; count: number };
type SendLog = { id: string; subject: string; categories: string[]; recipientCount: number; sentAt: string };

interface Props { list: string; basePath: string; contacts: Contact[]; matching: number; total: number; categories: Category[]; tags: Category[]; mediosCount: number; page: number; pageSize: number; initialSearch: string; initialCategory: string; sends: SendLog[] }

async function readError(res: Response, fallback: string): Promise<string> {
  try { const data = await res.json(); return typeof data.error === "string" ? data.error : fallback; } catch { return fallback; }
}

export function OutreachClient({ list, basePath, contacts, matching, total, categories, tags, mediosCount, page, pageSize, initialSearch, initialCategory, sends }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (categoryFilter) params.set("category", categoryFilter);
      const qs = params.toString();
      router.replace(`${basePath}${qs ? `?${qs}` : ""}`);
    }, 300);
    return () => clearTimeout(t);
  }, [search, categoryFilter, router, basePath]);

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (categoryFilter) params.set("category", categoryFilter);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  }

  async function remove(c: Contact) {
    setBusyId(c.id);
    const res = await fetch(`/api/outreach/${c.id}`, { method: "DELETE" }).catch(() => null);
    setBusyId(null);
    if (!res || !res.ok) { toast({ title: "No se pudo eliminar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return false; }
    toast({ title: `${c.name} eliminado`, variant: "success" });
    router.refresh();
    return true;
  }

  const totalPages = Math.max(1, Math.ceil(matching / pageSize));
  const from = matching === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, matching);
  const isFiltered = !!(search || categoryFilter);

  return (
    <div className="space-y-6">
      <Card padding="sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input type="search" placeholder="Buscar nombre, email, empresa, cargo…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Buscar contactos" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {categories.length > 0 && (
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filtrar por categoría" className="w-auto min-w-[160px]">
                <option value="">Todas las categorías</option>
                {categories.map((c) => (<option key={c.name} value={c.name}>{c.name} ({c.count})</option>))}
              </Select>
            )}
            <Button onClick={() => setShowImport(true)} variant="secondary" leftIcon={<Upload className="h-4 w-4" />}>Importar CSV</Button>
            <Button onClick={() => setShowAdd(true)} variant="secondary" leftIcon={<Plus className="h-4 w-4" />}>Agregar</Button>
            <Button onClick={() => setShowSend(true)} leftIcon={<Send className="h-4 w-4" />}>Enviar invitación</Button>
          </div>
        </div>
      </Card>

      {sends.length > 0 && (
        <Card padding="sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted"><Mail className="h-3.5 w-3.5" /> Últimos envíos</div>
          <ul className="mt-2 divide-y divide-border text-sm">
            {sends.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="font-medium text-ink-primary">{s.subject}</span>
                <span className="text-xs text-ink-muted">{s.categories.length ? s.categories.join(", ") : "Toda la base"} · {s.recipientCount} contactos · {new Date(s.sentAt).toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {contacts.length === 0 ? (
        <EmptyState icon={<Users />} title={isFiltered ? "Ningún contacto coincide" : "Todavía no hay contactos"} description={isFiltered ? "Prueba otro nombre o categoría, o limpia los filtros." : "Agrega un contacto a mano o importa un CSV."}
          action={isFiltered ? <Button variant="secondary" onClick={() => { setSearch(""); setCategoryFilter(""); }}>Limpiar filtros</Button> : <Button onClick={() => setShowImport(true)} leftIcon={<Upload className="h-4 w-4" />}>Importar CSV</Button>} />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <TableWrap className="rounded-none border-0 shadow-none">
            <Table>
              <thead><tr><Th>Nombre</Th><Th>Email</Th><Th>Empresa</Th><Th>Categoría</Th><Th>Teléfono</Th><Th align="right"><span className="sr-only">Acciones</span></Th></tr></thead>
              <tbody>
                {contacts.map((c) => {
                  const busy = busyId === c.id;
                  return (
                    <tr key={c.id} className={c.isActive ? undefined : "opacity-50"}>
                      <Td>
                        <span className="font-medium text-ink-primary">{c.name}</span>
                        {c.role && <div className="text-xs text-ink-muted">{c.role}</div>}
                        {c.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{c.tags.map((t) => (<Badge key={t} tone="outline" size="xs">{t}</Badge>))}</div>}
                      </Td>
                      <Td className="text-ink-secondary">{c.email || "—"}</Td>
                      <Td className="text-ink-secondary">{c.company || "—"}</Td>
                      <Td>{c.category ? <Badge tone="info">{c.category}</Badge> : <span className="text-ink-muted">—</span>}</Td>
                      <Td className="text-ink-muted">{c.phone || "—"}</Td>
                      <Td align="right">
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuDots label={`Acciones para ${c.name}`} className={busy ? "pointer-events-none opacity-50" : undefined} />
                            <DropdownMenuContent>
                              <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditing(c)}>Editar</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem icon={<Trash2 />} destructive disabled={busy} onSelect={() => setRemoving(c)}>{busy ? "Eliminando…" : "Eliminar"}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-muted">{isFiltered ? `${matching} de ${total} contactos` : `${total} contactos`}{matching > pageSize ? ` · mostrando ${from}–${to}` : ""}</p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => goToPage(page - 1)} disabled={page <= 1} leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}>Anterior</Button>
                <span className="text-xs text-ink-muted tabular">Página {page} de {totalPages}</span>
                <Button variant="secondary" size="sm" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} rightIcon={<ChevronRight className="h-3.5 w-3.5" />}>Siguiente</Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <ContactFormModal open={showAdd} onOpenChange={setShowAdd} categories={categories} list={list} />
      {editing && <ContactFormModal open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }} contact={editing} categories={categories} list={list} />}
      <ImportCsvModal open={showImport} onOpenChange={setShowImport} list={list} />
      <SendModal open={showSend} onOpenChange={setShowSend} categories={categories} tags={tags} mediosCount={mediosCount} list={list} />
      <ConfirmModal open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }} title={removing ? `¿Eliminar a ${removing.name}?` : "¿Eliminar contacto?"} description="Sale de esta base de datos. Puedes volver a agregarlo después." confirmLabel="Eliminar" destructive loading={!!removing && busyId === removing.id}
        onConfirm={async () => { if (!removing) return; const ok = await remove(removing); if (ok) setRemoving(null); }} />
    </div>
  );
}

// ─── Add / Edit ───────────────────────────────────────────

function ContactFormModal({ open, onOpenChange, contact, categories, list }: { open: boolean; onOpenChange: (o: boolean) => void; contact?: Contact; categories: Category[]; list: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isEdit = !!contact;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const str = (k: string) => String(form.get(k) ?? "").trim();
    const body = { list, name: str("name"), email: str("email").toLowerCase(), company: str("company"), role: str("role"), category: str("category"), phone: str("phone"), city: str("city"), country: str("country"), notes: str("notes"), tags: str("tags").split(",").map((t) => t.trim()).filter(Boolean) };
    const res = await fetch(isEdit ? `/api/outreach/${contact!.id}` : "/api/outreach", { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setLoading(false);
    if (!res || !res.ok) { toast({ title: isEdit ? "No se pudo guardar" : "No se pudo agregar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return; }
    onOpenChange(false);
    toast({ title: isEdit ? "Contacto actualizado" : "Contacto agregado", variant: "success" });
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={isEdit ? "Editar contacto" : "Agregar contacto"} description={isEdit ? `Editando a ${contact!.name}` : "Nuevo contacto de la industria"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Nombre" htmlFor="o-name" required><Input id="o-name" name="name" defaultValue={contact?.name} required autoFocus /></FormGroup>
          <FormGroup label="Email" htmlFor="o-email" hint="email o teléfono, al menos uno"><Input id="o-email" name="email" type="email" defaultValue={contact?.email ?? ""} /></FormGroup>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormGroup label="Empresa" htmlFor="o-company"><Input id="o-company" name="company" defaultValue={contact?.company ?? ""} placeholder="Rimas, WME, Kaseya Center…" /></FormGroup>
          <FormGroup label="Cargo" htmlFor="o-role"><Input id="o-role" name="role" defaultValue={contact?.role ?? ""} placeholder="Manager, A&R, Promoter…" /></FormGroup>
          <FormGroup label="Categoría" htmlFor="o-category">
            <Input id="o-category" name="category" list="o-categories" defaultValue={contact?.category ?? ""} placeholder="Management, Disqueras…" />
            <datalist id="o-categories">{categories.map((c) => (<option key={c.name} value={c.name} />))}</datalist>
          </FormGroup>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormGroup label="Teléfono" htmlFor="o-phone" description="Sin email solo recibe WhatsApp o llamada, no las invitaciones por correo."><Input id="o-phone" name="phone" type="tel" defaultValue={contact?.phone ?? ""} placeholder="+1 305 …" /></FormGroup>
          <FormGroup label="Ciudad" htmlFor="o-city"><Input id="o-city" name="city" defaultValue={contact?.city ?? ""} placeholder="Miami" /></FormGroup>
          <FormGroup label="País" htmlFor="o-country"><Input id="o-country" name="country" defaultValue={contact?.country ?? ""} placeholder="USA" /></FormGroup>
        </div>
        <FormGroup label="Etiquetas" htmlFor="o-tags" hint="separadas por coma" description="Sirven para elegir a quién va cada invitación."><Input id="o-tags" name="tags" defaultValue={contact?.tags.join(", ") ?? ""} placeholder="Off The Record, VIP" /></FormGroup>
        <FormGroup label="Notas" htmlFor="o-notes"><Textarea id="o-notes" name="notes" rows={2} defaultValue={contact?.notes ?? ""} /></FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? "Guardar" : "Agregar"}</Button>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─── CSV import (paste) ───────────────────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === "," || ch === "\t" || ch === ";") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function ImportCsvModal({ open, onOpenChange, list }: { open: boolean; onOpenChange: (o: boolean) => void; list: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const rows = parseCsv(text);
  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const col = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const hasHeader = col("email", "correo", "tel", "phone", "nombre", "name") >= 0;
  const idx = hasHeader ? { name: col("nombre", "name"), email: col("email", "correo"), company: col("empresa", "company"), role: col("cargo", "role", "title"), category: col("categor"), phone: col("tel", "phone") } : { name: 0, email: 2, company: 1, role: -1, category: -1, phone: -1 };
  const data = (hasHeader ? rows.slice(1) : rows).map((r) => ({ name: r[idx.name]?.trim() ?? "", email: (r[idx.email] ?? "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0]?.toLowerCase() ?? "", company: idx.company >= 0 ? r[idx.company]?.trim() : "", role: idx.role >= 0 ? r[idx.role]?.trim() : "", category: idx.category >= 0 ? r[idx.category]?.trim() : "", phone: idx.phone >= 0 ? r[idx.phone]?.trim() : "" })).filter((r) => r.email || r.phone);

  async function submit() {
    setLoading(true);
    const res = await fetch("/api/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ list, rows: data.map((r) => ({ ...r, email: r.email || undefined, name: r.name || (r.email ? r.email.split("@")[0] : r.phone) })) }) }).catch(() => null);
    setLoading(false);
    if (!res || !res.ok) { toast({ title: "No se pudo importar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return; }
    const out = await res.json();
    toast({ title: `Importados: ${out.created} nuevos, ${out.updated} actualizados${out.errorCount ? `, ${out.errorCount} con error` : ""}`, variant: "success" });
    setText(""); onOpenChange(false); router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Importar CSV" description="Pega las filas: Nombre, Empresa, Email (o un CSV con encabezados nombre / email / teléfono / empresa / cargo / categoría). Cada contacto necesita email o teléfono." size="lg">
      <div className="space-y-4">
        <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Juan Diego, La Industria Inc, jd@laindustria.com\n…"} className="font-mono text-xs" />
        <p className="text-xs text-ink-muted">{data.length} contactos detectados ({data.filter((r) => r.email).length} con email, {data.filter((r) => !r.email).length} solo con teléfono){hasHeader ? " · con encabezados" : ""}.</p>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={submit} loading={loading} disabled={!data.length}>Importar {data.length || ""}</Button>
        </FormActions>
      </div>
    </Modal>
  );
}

// ─── Send invitation ──────────────────────────────────────

function SendModal({ open, onOpenChange, categories, tags, mediosCount, list }: { open: boolean; onOpenChange: (o: boolean) => void; categories: Category[]; tags: Category[]; mediosCount: number; list: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [selTags, setSelTags] = useState<string[]>([]);
  const [exclTags, setExclTags] = useState<string[]>([]);
  const [withMedios, setWithMedios] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [sending, setSending] = useState<"test" | "all" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [flyer, setFlyer] = useState<File | null>(null);
  const [fromName, setFromName] = useState("");
  const [footer, setFooter] = useState("EB Public Relations · press@ebmanagement.io");
  const [noHeader, setNoHeader] = useState(false);
  const [directTo, setDirectTo] = useState("");
  const [directCc, setDirectCc] = useState("");

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams(); params.set("count", "1"); params.set("withEmail", "1"); params.set("list", list); if (selected.length) params.set("categories", selected.join(","));
    if (selTags.length) params.set("tag", selTags.join(","));
    if (exclTags.length) params.set("excludeTags", exclTags.join(","));
    if (withMedios) params.set("includeMedios", "1");
    fetch(`/api/outreach?${params}`).then((r) => r.json()).then((d) => setCount(typeof d.total === "number" ? d.total : null)).catch(() => setCount(null));
  }, [open, selected, selTags, exclTags, withMedios, list]);

  async function send(test: boolean) {
    setSending(test ? "test" : "all");
    const form = new FormData();
    form.set("list", list); form.set("subject", subject); form.set("body", body); form.set("categories", selected.join(",")); form.set("test", String(test));
    if (flyer) form.set("flyer", flyer);
    if (fromName.trim()) form.set("fromName", fromName.trim());
    if (noHeader) form.set("header", ""); else if (fromName.trim()) form.set("header", fromName.trim().toUpperCase());
    form.set("footer", footer.trim());
    form.set("to", directTo.trim()); form.set("cc", directCc.trim());
    if (selTags.length) form.set("tags", selTags.join(","));
    if (exclTags.length) form.set("excludeTags", exclTags.join(","));
    form.set("includeMedios", String(withMedios));
    const res = await fetch("/api/outreach/send", { method: "POST", body: form }).catch(() => null);
    setSending(null);
    if (!res || !res.ok) { toast({ title: test ? "No se pudo enviar la prueba" : "No se pudo enviar", description: res ? await readError(res, "Error") : "Sin conexión", variant: "error" }); return; }
    const out = await res.json();
    if (test) { toast({ title: "Prueba enviada a tu correo", variant: "success" }); return; }
    toast({ title: directTo.trim() ? `Enviada a ${directTo.trim()}` : `Invitación enviada a ${out.recipients} contactos`, description: out.skipped ? `${out.skipped} quedaron fuera por el tope diario de Gmail.` : undefined, variant: "success" });
    setConfirm(false); onOpenChange(false); setSubject(""); setBody(""); setSelected([]); setSelTags([]); setExclTags([]); setWithMedios(false); setFlyer(null); setDirectTo(""); setDirectCc(""); router.refresh();
  }

  const ready = subject.trim().length > 0 && body.trim().length > 0;
  return (
    <>
      <Modal open={open && !confirm} onOpenChange={onOpenChange} title="Enviar invitación" description="Sale desde press@ebmanagement.io en copia oculta, con el remitente que elijas; las respuestas te llegan a ti." size="lg">
        <div className="space-y-4">
          <FormGroup label="Asunto" htmlFor="s-subject" required><Input id="s-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Invitación · Off The Record Miami" /></FormGroup>
          <FormGroup label="Mensaje" htmlFor="s-body" required description="Texto plano. Deja una línea en blanco entre párrafos; los links se vuelven clicables."><Textarea id="s-body" rows={9} value={body} onChange={(e) => setBody(e.target.value)} /></FormGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormGroup label="Remitente" htmlFor="s-from" hint="opcional" description="Nombre que ve el invitado y encabezado del correo. Vacío = EB Public Relations."><Input id="s-from" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="CMN Events & La Industria Inc." /></FormGroup>
            <FormGroup label="Pie del correo" htmlFor="s-footer" hint="opcional" description="Línea final en gris. Déjalo vacío para no poner nada."><Input id="s-footer" value={footer} onChange={(e) => setFooter(e.target.value)} /></FormGroup>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-secondary"><input type="checkbox" checked={noHeader} onChange={(e) => setNoHeader(e.target.checked)} /> Sin banda de encabezado (solo flyer y texto)</label>
          <FormGroup label="Flyer" htmlFor="s-flyer" hint="opcional" description="PNG o JPG hasta 5 MB. Va arriba del mensaje, como imagen del correo.">
            <input id="s-flyer" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setFlyer(e.target.files?.[0] ?? null)} className="block w-full text-sm text-ink-secondary file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium" />
          </FormGroup>
          <div>
            <div className="text-sm font-medium text-ink-primary">¿A quién?</div>
            <p className="text-xs text-ink-muted">Sin marcar nada va a toda la base. Marca categorías o etiquetas para acotar; una categoría o una etiqueta marcada basta para entrar.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = selected.includes(c.name);
                return (
                  <button key={c.name} type="button" onClick={() => setSelected(on ? selected.filter((s) => s !== c.name) : [...selected, c.name])} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-ink-primary bg-ink-primary text-white" : "border-border text-ink-secondary hover:border-ink-muted"}`}>
                    {c.name} · {c.count}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormGroup label="Solo a estos correos" htmlFor="s-to" hint="opcional" description="Si lo llenas, el correo va únicamente a ellos (no a la base). Separa con comas."><Input id="s-to" value={directTo} onChange={(e) => setDirectTo(e.target.value)} placeholder="mcorrea@cmnevents.com" /></FormGroup>
            <FormGroup label="Con copia (cc)" htmlFor="s-cc" hint="opcional"><Input id="s-cc" value={directCc} onChange={(e) => setDirectCc(e.target.value)} placeholder="esther@ebmanagement.io" /></FormGroup>
          </div>
          {tags.length > 0 && (
            <div>
              <div className="text-sm font-medium text-ink-primary">Etiquetas</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((t) => { const on = selTags.includes(t.name); return (<button key={t.name} type="button" onClick={() => setSelTags(on ? selTags.filter((s) => s !== t.name) : [...selTags, t.name])} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-ink-primary bg-ink-primary text-white" : "border-border text-ink-secondary hover:border-ink-muted"}`}>{t.name} · {t.count}</button>); })}
              </div>
              <div className="mt-3 text-sm font-medium text-ink-primary">Excluir etiquetas</div>
              <p className="text-xs text-ink-muted">Quien tenga una de estas no recibe el correo (por ejemplo los ya confirmados).</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((t) => { const on = exclTags.includes(t.name); return (<button key={t.name} type="button" onClick={() => setExclTags(on ? exclTags.filter((s) => s !== t.name) : [...exclTags, t.name])} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-red-600 bg-red-600 text-white" : "border-border text-ink-secondary hover:border-ink-muted"}`}>{t.name} · {t.count}</button>); })}
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-ink-secondary"><input type="checkbox" checked={withMedios} onChange={(e) => setWithMedios(e.target.checked)} /> Incluir también la base de Medios ({mediosCount} periodistas)</label>
          {!!count && count > 1500 && !directTo.trim() && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Gmail permite unos 1,500 correos por día: de {count} saldrán los primeros 1,500 y el resto queda fuera. Divide el envío (por ejemplo Medios un día, Industria al siguiente).</p>}
          <p className="text-sm text-ink-secondary">{directTo.trim() ? <>Va solo a <strong>{directTo.trim()}</strong>{directCc.trim() ? ` (cc ${directCc.trim()})` : ""}.</> : <>Destinatarios: <strong>{count ?? "…"}</strong> contactos activos con email.</>}</p>
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="button" variant="secondary" onClick={() => send(true)} loading={sending === "test"} disabled={!ready}>Enviarme una prueba</Button>
            <Button type="button" onClick={() => setConfirm(true)} disabled={!ready || (!directTo.trim() && !count)} leftIcon={<Send className="h-4 w-4" />}>{directTo.trim() ? "Enviar" : `Enviar a ${count ?? 0}`}</Button>
          </FormActions>
        </div>
      </Modal>
      <ConfirmModal open={confirm} onOpenChange={setConfirm} title={directTo.trim() ? `¿Enviar "${subject}" a ${directTo.trim()}?` : `¿Enviar "${subject}" a ${count ?? 0} contactos?`} description={directTo.trim() ? "Sale ahora mismo solo a esos correos." : "Sale ahora mismo en lotes de 50 en copia oculta. No se puede deshacer."} confirmLabel="Sí, enviar" loading={sending === "all"} onConfirm={() => send(false)} />
    </>
  );
}
