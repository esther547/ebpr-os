"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea, FormGroup } from "@/components/ui/form-field";
import { Search, Upload } from "lucide-react";

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
  const [search, setSearch] = useState(initialSearch);
  const [beatFilter, setBeatFilter] = useState(initialBeat);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const router = useRouter();
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
    if (!confirm(`Remove ${j.name} from the journalist list?`)) return;
    setBusyId(j.id);
    setRowError(null);
    const res = await fetch(`/api/journalists/${j.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      setRowError(res ? await readError(res, "Failed to remove journalist") : "Network error");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    router.refresh();
  }

  const totalPages = Math.max(1, Math.ceil(matching / pageSize));
  const from = matching === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, matching);

  return (
    <>
      {/* Search & Filter Bar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            type="text"
            placeholder="Search name, email, outlet, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-white pl-10 pr-4 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ink-primary/20"
          />
        </div>
        {beats.length > 0 && (
          <select
            value={beatFilter}
            onChange={(e) => setBeatFilter(e.target.value)}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="">All Beats</option>
            {beats.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}
        <Button onClick={() => setShowImport(true)} size="sm" variant="secondary">
          <Upload className="h-3.5 w-3.5" /> Import CSV
        </Button>
        <Button onClick={() => setShowAdd(true)} size="sm">+ Add Journalist</Button>
      </div>

      {rowError && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{rowError}</div>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-ink-muted">
          {search || beatFilter
            ? `${matching} match${matching === 1 ? "" : "es"} of ${total} contacts`
            : `${total} contacts`}
          {matching > pageSize ? ` · showing ${from}–${to}` : ""}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded border border-border px-2 py-1 disabled:opacity-40 hover:bg-surface-1"
            >
              Prev
            </button>
            <span className="text-ink-muted">Page {page} of {totalPages}</span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded border border-border px-2 py-1 disabled:opacity-40 hover:bg-surface-1"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-1">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Email</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Outlet</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Beat</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Location</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {journalists.map((j) => (
              <tr key={j.id} className="hover:bg-surface-1 transition-colors">
                <td className="px-5 py-4 font-medium text-ink-primary">
                  {j.name}
                  {j.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {j.tags.map((t) => (
                        <span key={t} className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-ink-secondary">{t}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-5 py-4 text-ink-secondary">{j.email}</td>
                <td className="px-5 py-4 text-ink-secondary">{j.outlet || "—"}</td>
                <td className="px-5 py-4">
                  {j.beat ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{j.beat}</span>
                  ) : "—"}
                </td>
                <td className="px-5 py-4 text-ink-muted">{[j.city, j.country].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditing(j)} className="text-xs text-blue-600 hover:underline">
                      Edit
                    </button>
                    <button
                      onClick={() => remove(j)}
                      disabled={busyId === j.id}
                      className="text-xs text-red-600 hover:underline disabled:opacity-40"
                    >
                      {busyId === j.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {journalists.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-ink-muted">
                  {search || beatFilter
                    ? "No journalists match your search."
                    : "No journalists yet. Add one or import a CSV."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <JournalistFormModal open={showAdd} onOpenChange={setShowAdd} />
      {editing && (
        <JournalistFormModal
          open={!!editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          journalist={editing}
        />
      )}
      <ImportCsvModal open={showImport} onOpenChange={setShowImport} />
    </>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!journalist;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
      setError(res ? await readError(res, isEdit ? "Failed to save journalist" : "Failed to add journalist") : "Network error");
      setLoading(false);
      return;
    }

    setLoading(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Journalist" : "Add Journalist"}
      description={isEdit ? `Editing ${journalist!.name}` : "Add a new media contact"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Name" htmlFor="j-name" required>
            <Input id="j-name" name="name" defaultValue={journalist?.name} required autoFocus />
          </FormGroup>
          <FormGroup label="Email" htmlFor="j-email" required>
            <Input id="j-email" name="email" type="email" defaultValue={journalist?.email} required />
          </FormGroup>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Outlet" htmlFor="j-outlet">
            <Input id="j-outlet" name="outlet" defaultValue={journalist?.outlet ?? ""} placeholder="e.g., People en Español" />
          </FormGroup>
          <FormGroup label="Beat" htmlFor="j-beat">
            <Input id="j-beat" name="beat" defaultValue={journalist?.beat ?? ""} placeholder="e.g., Entertainment" />
          </FormGroup>
        </div>

        <div className="grid grid-cols-3 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Phone" htmlFor="j-phone">
            <Input id="j-phone" name="phone" defaultValue={journalist?.phone ?? ""} />
          </FormGroup>
          <FormGroup label="Tags (comma separated)" htmlFor="j-tags">
            <Input id="j-tags" name="tags" defaultValue={journalist?.tags.join(", ") ?? ""} placeholder="music, latin, tv" />
          </FormGroup>
        </div>

        <FormGroup label="Notes" htmlFor="j-notes">
          <Textarea id="j-notes" name="notes" rows={2} defaultValue={journalist?.notes ?? ""} />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? (isEdit ? "Saving..." : "Adding...") : isEdit ? "Save Changes" : "Add Journalist"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
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
        setError(res ? await readError(res, "Import failed") : "Network error");
        setProgress(null);
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
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      title="Import Journalists from CSV"
      description="Header row with name, email and optionally outlet, beat, phone, city, country, language, notes, tags"
    >
      <div className="space-y-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="block w-full text-sm text-ink-secondary file:mr-3 file:rounded-md file:border file:border-border file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium"
        />

        {parseError && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{parseError}</div>}
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {rows.length > 0 && !result && (
          <div className="rounded-md bg-surface-1 px-4 py-3 text-sm text-ink-secondary">
            <p className="font-medium text-ink-primary">{fileName}</p>
            <p>{rows.length.toLocaleString()} rows ready. Existing emails are skipped, not overwritten.</p>
            <p className="mt-1 text-xs text-ink-muted">
              Preview: {rows.slice(0, 3).map((r) => `${r.name} <${r.email}>`).join(" · ")}
            </p>
          </div>
        )}

        {progress && (
          <div>
            <div className="flex justify-between text-xs text-ink-muted mb-1">
              <span>Importing...</span>
              <span>{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full bg-ink-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
            <p className="font-medium">Imported {result.created.toLocaleString()} journalists</p>
            <p className="text-xs mt-0.5">
              {result.skipped.toLocaleString()} duplicate{result.skipped === 1 ? "" : "s"} skipped
              {result.invalid ? ` · ${result.invalid.toLocaleString()} invalid row${result.invalid === 1 ? "" : "s"} ignored` : ""}
            </p>
            {result.samples.length > 0 && (
              <ul className="mt-2 text-xs text-green-900/80 list-disc pl-4">
                {result.samples.map((s) => <li key={s}>{s}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {!result ? (
            <Button onClick={runImport} disabled={rows.length === 0 || !!progress}>
              {progress ? "Importing..." : `Import ${rows.length ? rows.length.toLocaleString() : ""}`.trim()}
            </Button>
          ) : (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          )}
          <Button type="button" variant="secondary" onClick={() => { reset(); onOpenChange(false); }} disabled={!!progress}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
