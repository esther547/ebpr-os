"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/form-field";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { Input, Select, Textarea, FormGroup, FormActions } from "@/components/ui/form-field";
import { Card } from "@/components/ui/card";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuDots,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type Journalist = {
  id: string;
  name: string;
  email: string;
  outlet: string | null;
  beat: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  language: string | null;
  notes: string | null;
  tags: string[];
};

interface Props {
  journalists: Journalist[];
  matching: number;
  total: number;
  beats: string[];
  page: number;
  pageSize: number;
  initialSearch: string;
  initialBeat: string;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export function JournalistsClient({
  journalists,
  matching,
  total,
  beats,
  page,
  pageSize,
  initialSearch,
  initialBeat,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Journalist | null>(null);
  const [removing, setRemoving] = useState<Journalist | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [beatFilter, setBeatFilter] = useState(initialBeat);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const firstRender = useRef(true);

  // Server-side filtering: push search/beat into the URL (debounced) and let the page re-query.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (beatFilter) params.set("beat", beatFilter);
      const qs = params.toString();
      router.replace(`/journalists${qs ? `?${qs}` : ""}`);
    }, 300);
    return () => clearTimeout(t);
  }, [search, beatFilter, router]);

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (beatFilter) params.set("beat", beatFilter);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    router.push(`/journalists${qs ? `?${qs}` : ""}`);
  }

  async function remove(j: Journalist) {
    setBusyId(j.id);
    const res = await fetch(`/api/journalists/${j.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      toast({
        title: "Could not remove journalist",
        description: res ? await readError(res, "Failed to remove journalist") : "Network error",
        variant: "error",
      });
      setBusyId(null);
      return false;
    }
    setBusyId(null);
    toast({ title: `${j.name} removed`, variant: "success" });
    router.refresh();
    return true;
  }

  const totalPages = Math.max(1, Math.ceil(matching / pageSize));
  const from = matching === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, matching);
  const isFiltered = !!(search || beatFilter);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <Card padding="sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              type="search"
              placeholder="Search name, email, outlet, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search journalists"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {beats.length > 0 && (
              <Select
                value={beatFilter}
                onChange={(e) => setBeatFilter(e.target.value)}
                aria-label="Filter by beat"
                className="w-auto min-w-[140px]"
              >
                <option value="">All beats</option>
                {beats.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
            )}
            <Button
              onClick={() => setShowImport(true)}
              variant="secondary"
              leftIcon={<Upload className="h-4 w-4" />}
            >
              Import CSV
            </Button>
            <Button onClick={() => setShowAdd(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Add Journalist
            </Button>
          </div>
        </div>
      </Card>

      {journalists.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={isFiltered ? "No journalists match your search" : "No journalists yet"}
          description={
            isFiltered
              ? "Try a different name, outlet or beat — or clear the filters."
              : "Add a contact by hand, or import your existing media list from a CSV."
          }
          action={
            isFiltered ? (
              <Button
                variant="secondary"
                onClick={() => { setSearch(""); setBeatFilter(""); }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setShowImport(true)} leftIcon={<Upload className="h-4 w-4" />}>
                Import CSV
              </Button>
            )
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <TableWrap className="rounded-none border-0 shadow-none">
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Outlet</Th>
                  <Th>Beat</Th>
                  <Th>Location</Th>
                  <Th align="right"><span className="sr-only">Actions</span></Th>
                </tr>
              </thead>
              <tbody>
                {journalists.map((j) => {
                  const busy = busyId === j.id;
                  return (
                    <tr key={j.id}>
                      <Td>
                        <span className="font-medium text-ink-primary">{j.name}</span>
                        {j.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {j.tags.map((t) => (
                              <Badge key={t} tone="outline" size="xs">{t}</Badge>
                            ))}
                          </div>
                        )}
                      </Td>
                      <Td className="text-ink-secondary">{j.email}</Td>
                      <Td className="text-ink-secondary">{j.outlet || "—"}</Td>
                      <Td>
                        {j.beat ? <Badge tone="info">{j.beat}</Badge> : <span className="text-ink-muted">—</span>}
                      </Td>
                      <Td className="text-ink-muted">
                        {[j.city, j.country].filter(Boolean).join(", ") || "—"}
                      </Td>
                      <Td align="right">
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuDots
                              label={`Actions for ${j.name}`}
                              className={busy ? "pointer-events-none opacity-50" : undefined}
                            />
                            <DropdownMenuContent>
                              <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditing(j)}>
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                icon={<Trash2 />}
                                destructive
                                disabled={busy}
                                onSelect={() => setRemoving(j)}
                              >
                                {busy ? "Removing..." : "Remove"}
                              </DropdownMenuItem>
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
            <p className="text-xs text-ink-muted">
              {isFiltered
                ? `${matching} match${matching === 1 ? "" : "es"} of ${total} contacts`
                : `${total} contacts`}
              {matching > pageSize ? ` · showing ${from}–${to}` : ""}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
                >
                  Prev
                </Button>
                <span className="text-xs text-ink-muted tabular">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <JournalistFormModal open={showAdd} onOpenChange={setShowAdd} />
      {editing && (
        <JournalistFormModal
          open={!!editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          journalist={editing}
        />
      )}
      <ImportCsvModal open={showImport} onOpenChange={setShowImport} />

      <ConfirmModal
        open={!!removing}
        onOpenChange={(o) => { if (!o) setRemoving(null); }}
        title={removing ? `Remove ${removing.name}?` : "Remove journalist?"}
        description="They will be taken off the journalist list. You can add them again later."
        confirmLabel="Remove"
        destructive
        loading={!!removing && busyId === removing.id}
        onConfirm={async () => {
          if (!removing) return;
          const ok = await remove(removing);
          if (ok) setRemoving(null);
        }}
      />
    </div>
  );
}

// ─── Add / Edit ───────────────────────────────────────────

function JournalistFormModal({
  open,
  onOpenChange,
  journalist,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  journalist?: Journalist;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isEdit = !!journalist;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const str = (k: string) => String(form.get(k) ?? "").trim();
    const body = {
      name: str("name"),
      email: str("email").toLowerCase(),
      outlet: str("outlet"),
      beat: str("beat"),
      phone: str("phone"),
      city: str("city"),
      country: str("country"),
      language: str("language"),
      notes: str("notes"),
      tags: str("tags").split(",").map((t) => t.trim()).filter(Boolean),
    };

    const res = await fetch(isEdit ? `/api/journalists/${journalist!.id}` : "/api/journalists", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

    if (!res || !res.ok) {
      toast({
        title: isEdit ? "Could not save journalist" : "Could not add journalist",
        description: res
          ? await readError(res, isEdit ? "Failed to save journalist" : "Failed to add journalist")
          : "Network error",
        variant: "error",
      });
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    toast({ title: isEdit ? "Journalist updated" : "Journalist added", variant: "success" });
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Journalist" : "Add Journalist"}
      description={isEdit ? `Editing ${journalist!.name}` : "Add a new media contact"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Name" htmlFor="j-name" required>
            <Input id="j-name" name="name" defaultValue={journalist?.name} required autoFocus />
          </FormGroup>
          <FormGroup label="Email" htmlFor="j-email" required>
            <Input id="j-email" name="email" type="email" defaultValue={journalist?.email} required />
          </FormGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Outlet" htmlFor="j-outlet">
            <Input id="j-outlet" name="outlet" defaultValue={journalist?.outlet ?? ""} placeholder="e.g., People en Español" />
          </FormGroup>
          <FormGroup label="Beat" htmlFor="j-beat">
            <Input id="j-beat" name="beat" defaultValue={journalist?.beat ?? ""} placeholder="e.g., Entertainment" />
          </FormGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormGroup label="City" htmlFor="j-city">
            <Input id="j-city" name="city" defaultValue={journalist?.city ?? ""} placeholder="Miami" />
          </FormGroup>
          <FormGroup label="Country" htmlFor="j-country">
            <Input id="j-country" name="country" defaultValue={journalist?.country ?? ""} placeholder="USA" />
          </FormGroup>
          <FormGroup label="Language" htmlFor="j-lang">
            <Select id="j-lang" name="language" defaultValue={journalist?.language ?? ""}>
              <option value="">Select...</option>
              <option value="Spanish">Spanish</option>
              <option value="English">English</option>
              <option value="Both">Both</option>
            </Select>
          </FormGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormGroup label="Phone" htmlFor="j-phone">
            <Input id="j-phone" name="phone" defaultValue={journalist?.phone ?? ""} />
          </FormGroup>
          <FormGroup
            label="Tags"
            htmlFor="j-tags"
            hint="comma separated"
            description="Used to target press release distribution."
          >
            <Input id="j-tags" name="tags" defaultValue={journalist?.tags.join(", ") ?? ""} placeholder="music, latin, tv" />
          </FormGroup>
        </div>

        <FormGroup label="Notes" htmlFor="j-notes">
          <Textarea id="j-notes" name="notes" rows={2} defaultValue={journalist?.notes ?? ""} />
        </FormGroup>

        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? "Save Changes" : "Add Journalist"}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}

// ─── CSV Import ───────────────────────────────────────────

/** Minimal RFC-4180 CSV parser: handles quoted fields, escaped quotes, CRLF, and BOM. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, string> = {
  name: "name", nombre: "name", "full name": "name", journalist: "name", contact: "name",
  email: "email", "e-mail": "email", correo: "email", "email address": "email",
  outlet: "outlet", medio: "outlet", publication: "outlet", media: "outlet", "media outlet": "outlet",
  beat: "beat", section: "beat", topic: "beat", categoria: "beat", categoría: "beat",
  phone: "phone", telefono: "phone", teléfono: "phone", mobile: "phone", cell: "phone",
  city: "city", ciudad: "city",
  country: "country", pais: "country", país: "country",
  language: "language", idioma: "language", lang: "language",
  notes: "notes", notas: "notes", comments: "notes",
  tags: "tags", etiquetas: "tags", keywords: "tags",
};

type ImportRow = {
  name: string;
  email: string;
  outlet?: string;
  beat?: string;
  phone?: string;
  city?: string;
  country?: string;
  language?: string;
  notes?: string;
  tags?: string[];
};

function rowsToJournalists(rows: string[][]): { data: ImportRow[]; missing: string[] } {
  if (rows.length === 0) return { data: [], missing: ["name", "email"] };
  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? "");
  const idx = (key: string) => header.indexOf(key);
  const missing = ["name", "email"].filter((k) => idx(k) === -1);
  if (missing.length) return { data: [], missing };

  const get = (r: string[], key: string) => {
    const i = idx(key);
    return i === -1 ? "" : (r[i] ?? "").trim();
  };

  const data: ImportRow[] = rows.slice(1).map((r) => ({
    name: get(r, "name"),
    email: get(r, "email").toLowerCase(),
    outlet: get(r, "outlet") || undefined,
    beat: get(r, "beat") || undefined,
    phone: get(r, "phone") || undefined,
    city: get(r, "city") || undefined,
    country: get(r, "country") || undefined,
    language: get(r, "language") || undefined,
    notes: get(r, "notes") || undefined,
    tags: get(r, "tags") ? get(r, "tags").split(/[;,|]/).map((t) => t.trim()).filter(Boolean) : undefined,
  }));
  return { data, missing: [] };
}

const IMPORT_CHUNK = 1000;

function ImportCsvModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; invalid: number; samples: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRows([]); setFileName(null); setParseError(null); setProgress(null); setResult(null); setError(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    reset();
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = rowsToJournalists(parseCsv(text));
      if (parsed.missing.length) {
        setParseError(`CSV is missing required column${parsed.missing.length > 1 ? "s" : ""}: ${parsed.missing.join(", ")}. Expected a header row with at least "name" and "email".`);
        return;
      }
      if (parsed.data.length === 0) {
        setParseError("No data rows found under the header.");
        return;
      }
      setRows(parsed.data);
    } catch {
      setParseError("Could not read this file. Save it as UTF-8 CSV and try again.");
    }
  }

  async function runImport() {
    setError(null);
    setResult(null);
    let created = 0, skipped = 0, invalid = 0;
    const samples: string[] = [];
    setProgress({ done: 0, total: rows.length });

    for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
      const chunk = rows.slice(i, i + IMPORT_CHUNK);
      const res = await fetch("/api/journalists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      }).catch(() => null);
      if (!res || !res.ok) {
        const msg = res ? await readError(res, "Import failed") : "Network error";
        setError(msg);
        setProgress(null);
        toast({ title: "Import stopped", description: msg, variant: "error" });
        // Keep partial results visible
        setResult({ created, skipped, invalid, samples });
        router.refresh();
        return;
      }
      const data = await res.json();
      created += data.created ?? 0;
      skipped += data.skipped ?? 0;
      invalid += data.invalidCount ?? 0;
      for (const inv of data.invalid ?? []) {
        if (samples.length < 10) samples.push(`Row ${inv.row + i}: ${inv.reason}`);
      }
      setProgress({ done: Math.min(i + IMPORT_CHUNK, rows.length), total: rows.length });
    }

    setProgress(null);
    setResult({ created, skipped, invalid, samples });
    toast({
      title: `Imported ${created.toLocaleString()} journalist${created === 1 ? "" : "s"}`,
      description: skipped ? `${skipped.toLocaleString()} duplicate${skipped === 1 ? "" : "s"} skipped.` : undefined,
      variant: "success",
    });
    router.refresh();
  }

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      title="Import Journalists from CSV"
      description="Header row with name, email and optionally outlet, beat, phone, city, country, language, notes, tags"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => { reset(); onOpenChange(false); }}
            disabled={!!progress}
          >
            {result ? "Close" : "Cancel"}
          </Button>
          {!result ? (
            <Button onClick={runImport} disabled={rows.length === 0} loading={!!progress}>
              {progress ? "Importing..." : `Import ${rows.length ? rows.length.toLocaleString() : ""}`.trim()}
            </Button>
          ) : (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <FormGroup label="CSV file" htmlFor="csv-file">
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="block w-full cursor-pointer rounded-lg border border-border bg-white p-1.5 text-sm text-ink-secondary transition-colors hover:border-border-strong file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-primary"
          />
        </FormGroup>

        {parseError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {parseError}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {rows.length > 0 && !result && (
          <Card padding="sm" className="shadow-none">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium text-ink-primary">{fileName}</p>
              <Badge tone="neutral">{rows.length.toLocaleString()} rows</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              Existing emails are skipped, not overwritten.
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Preview: {rows.slice(0, 3).map((r) => `${r.name} <${r.email}>`).join(" · ")}
            </p>
          </Card>
        )}

        {progress && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="eyebrow">Importing</span>
              <span className="text-ink-muted tabular">
                {progress.done.toLocaleString()} / {progress.total.toLocaleString()} · {pct}%
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-ink-primary transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {result && (
          <Card padding="sm" className="shadow-none">
            <p className="text-sm font-medium text-ink-primary">
              Imported {result.created.toLocaleString()} journalist{result.created === 1 ? "" : "s"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="neutral">{result.skipped.toLocaleString()} duplicate{result.skipped === 1 ? "" : "s"} skipped</Badge>
              {result.invalid > 0 && (
                <Badge tone="warning">{result.invalid.toLocaleString()} invalid row{result.invalid === 1 ? "" : "s"} ignored</Badge>
              )}
            </div>
            {result.samples.length > 0 && (
              <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-ink-muted">
                {result.samples.map((s) => <li key={s}>{s}</li>)}
              </ul>
            )}
          </Card>
        )}
      </div>
    </Modal>
  );
}
