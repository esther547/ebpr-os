"use client";

import { useState } from "react";
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
  total: number;
  beats: string[];
}

export function JournalistsClient({ journalists, total, beats }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [beatFilter, setBeatFilter] = useState("");
  const router = useRouter();

  const filtered = journalists.filter((j) => {
    const matchSearch = !search ||
      j.name.toLowerCase().includes(search.toLowerCase()) ||
      j.email.toLowerCase().includes(search.toLowerCase()) ||
      (j.outlet?.toLowerCase().includes(search.toLowerCase()));
    const matchBeat = !beatFilter || j.beat === beatFilter;
    return matchSearch && matchBeat;
  });

  return (
    <>
      {/* Search & Filter Bar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            type="text"
            placeholder="Search name, email, outlet..."
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
        <Button onClick={() => setShowAdd(true)} size="sm">+ Add Journalist</Button>
      </div>

      <p className="text-xs text-ink-muted mb-3">Showing {filtered.length} of {total} contacts</p>

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
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((j) => (
              <tr key={j.id} className="hover:bg-surface-1 transition-colors">
                <td className="px-5 py-4 font-medium text-ink-primary">{j.name}</td>
                <td className="px-5 py-4 text-ink-secondary">{j.email}</td>
                <td className="px-5 py-4 text-ink-secondary">{j.outlet || "—"}</td>
                <td className="px-5 py-4">
                  {j.beat ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{j.beat}</span>
                  ) : "—"}
                </td>
                <td className="px-5 py-4 text-ink-muted">{[j.city, j.country].filter(Boolean).join(", ") || "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-ink-muted">
                  {search || beatFilter ? "No journalists match your search." : "No journalists yet. Add the first one."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddJournalistModal open={showAdd} onOpenChange={setShowAdd} />
    </>
  );
}

function AddJournalistModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      outlet: (form.get("outlet") as string) || undefined,
      beat: (form.get("beat") as string) || undefined,
      phone: (form.get("phone") as string) || undefined,
      city: (form.get("city") as string) || undefined,
      country: (form.get("country") as string) || undefined,
      language: (form.get("language") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
    };

    const res = await fetch("/api/journalists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to add journalist");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add Journalist" description="Add a new media contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Name" htmlFor="j-name" required>
            <Input id="j-name" name="name" required autoFocus />
          </FormGroup>
          <FormGroup label="Email" htmlFor="j-email" required>
            <Input id="j-email" name="email" type="email" required />
          </FormGroup>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormGroup label="Outlet" htmlFor="j-outlet">
            <Input id="j-outlet" name="outlet" placeholder="e.g., People en Español" />
          </FormGroup>
          <FormGroup label="Beat" htmlFor="j-beat">
            <Input id="j-beat" name="beat" placeholder="e.g., Entertainment" />
          </FormGroup>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormGroup label="City" htmlFor="j-city">
            <Input id="j-city" name="city" placeholder="Miami" />
          </FormGroup>
          <FormGroup label="Country" htmlFor="j-country">
            <Input id="j-country" name="country" placeholder="USA" />
          </FormGroup>
          <FormGroup label="Language" htmlFor="j-lang">
            <Select id="j-lang" name="language">
              <option value="">Select...</option>
              <option value="Spanish">Spanish</option>
              <option value="English">English</option>
              <option value="Both">Both</option>
            </Select>
          </FormGroup>
        </div>

        <FormGroup label="Notes" htmlFor="j-notes">
          <Textarea id="j-notes" name="notes" rows={2} />
        </FormGroup>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Adding..." : "Add Journalist"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
