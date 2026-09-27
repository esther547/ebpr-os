"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Megaphone, Pencil, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, SectionHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, FormActions, FormGroup, Input, Select, Textarea } from "@/components/ui/form-field";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage } from "@/lib/form-helpers";
import { IDEAS_PER_POST, ideasDone, isReady, type SocialIdea, type SocialPostItem } from "@/lib/social-posts";

type ClientOption = { id: string; name: string };
type Props = { initialPosts: SocialPostItem[]; clients: ClientOption[] };

const GENERAL = "__general__";

export function SocialBoard({ initialPosts, clients }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [posts, setPosts] = useState(initialPosts);
  const [showCreate, setShowCreate] = useState(false);
  const [editPost, setEditPost] = useState<SocialPostItem | null>(null);
  const [deletePost, setDeletePost] = useState<SocialPostItem | null>(null);
  const [showPosted, setShowPosted] = useState(false);

  const groups = useMemo(() => {
    const pending = posts.filter((p) => !p.postedAt);
    return {
      inProgress: pending.filter((p) => !isReady(p.ideas)),
      ready: pending.filter((p) => isReady(p.ideas)),
      posted: posts.filter((p) => p.postedAt).sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? "")),
    };
  }, [posts]);

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(apiErrorMessage(payload, "No se pudo completar la acción"));
    return payload.data as T;
  }
  function failed(err: unknown, fallback: string) {
    toast({ title: fallback, description: err instanceof Error ? err.message : undefined, variant: "error" });
  }

  async function patch(post: SocialPostItem, body: Record<string, unknown>, optimistic?: Partial<SocialPostItem>) {
    const before = posts;
    if (optimistic) setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...optimistic } : p)));
    try {
      const updated = await request<SocialPostItem>(`/api/social/${post.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...updated, postedAt: updated.postedAt ? String(updated.postedAt) : null } : p)));
      router.refresh();
    } catch (err) {
      setPosts(before);
      failed(err, "No se pudo guardar el cambio");
    }
  }

  async function create(draft: PostDraft) {
    try {
      const created = await request<SocialPostItem>("/api/social", { method: "POST", body: JSON.stringify(draft) });
      setPosts((prev) => [...prev, { ...created, postedAt: null }]);
      router.refresh();
    } catch (err) {
      failed(err, "No se pudo crear el post");
    }
  }

  async function remove(post: SocialPostItem) {
    const before = posts;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    setDeletePost(null);
    try {
      await request(`/api/social/${post.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setPosts(before);
      failed(err, "No se pudo eliminar el post");
    }
  }

  const stats = { pending: groups.inProgress.length, ready: groups.ready.length, posted: groups.posted.length };
  const cardProps = {
    onIdeas: (post: SocialPostItem, ideas: SocialIdea[]) => void patch(post, { ideas }, { ideas }),
    onPosted: (post: SocialPostItem, posted: boolean) => void patch(post, { posted }, { postedAt: posted ? new Date().toISOString() : null }),
    onEdit: (post: SocialPostItem) => setEditPost(post),
    onDelete: (post: SocialPostItem) => setDeletePost(post),
  };

  return (
    <>
      <PageHeader
        eyebrow="Contenido"
        title="Redes sociales"
        subtitle="Cada post lleva 3 ideas. Cuando las 3 están listas, el post está listo para publicarse."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
            Post
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatTile label="En preparación" value={stats.pending} icon={<Pencil />} />
        <StatTile label="Listos para postear" value={stats.ready} icon={<Send />} tone="success" />
        <StatTile label="Posteados" value={stats.posted} icon={<CheckCircle2 />} />
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title="Todavía no hay posts planeados"
          description='Crea el primero, por ejemplo "NEXT POST MARKO", y anota sus 3 ideas.'
          action={
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
              Post
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.ready.length > 0 && (
            <section>
              <SectionHeader title="Listos para postear" description="Las 3 ideas están completas." />
              <div className="grid gap-4 lg:grid-cols-2">
                {groups.ready.map((p) => <PostCard key={p.id} post={p} {...cardProps} />)}
              </div>
            </section>
          )}
          <section>
            <SectionHeader title="En preparación" description={`${groups.inProgress.length} ${groups.inProgress.length === 1 ? "post" : "posts"}`} />
            {groups.inProgress.length === 0 ? (
              <p className="text-sm text-ink-muted">Nada en preparación.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {groups.inProgress.map((p) => <PostCard key={p.id} post={p} {...cardProps} />)}
              </div>
            )}
          </section>
          {groups.posted.length > 0 && (
            <section>
              <SectionHeader
                title="Posteados"
                description={`${groups.posted.length} ${groups.posted.length === 1 ? "post" : "posts"}`}
                actions={
                  <Button variant="ghost" size="sm" onClick={() => setShowPosted((v) => !v)}>
                    {showPosted ? "Ocultar" : "Ver"}
                  </Button>
                }
              />
              {showPosted && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {groups.posted.map((p) => <PostCard key={p.id} post={p} {...cardProps} />)}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <PostModal open={showCreate} onOpenChange={setShowCreate} post={null} clients={clients} onSubmit={create} />
      <PostModal
        open={editPost !== null}
        onOpenChange={(open) => !open && setEditPost(null)}
        post={editPost}
        clients={clients}
        onSubmit={async (draft) => {
          if (editPost) await patch(editPost, draft);
        }}
      />
      <ConfirmModal
        open={deletePost !== null}
        onOpenChange={(open) => !open && setDeletePost(null)}
        title="Eliminar post"
        description={deletePost?.title}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (deletePost) void remove(deletePost);
        }}
      />
    </>
  );
}

// ─── Card ──────────────────────────────────────────────

function PostCard({
  post,
  onIdeas,
  onPosted,
  onEdit,
  onDelete,
}: {
  post: SocialPostItem;
  onIdeas: (post: SocialPostItem, ideas: SocialIdea[]) => void;
  onPosted: (post: SocialPostItem, posted: boolean) => void;
  onEdit: (post: SocialPostItem) => void;
  onDelete: (post: SocialPostItem) => void;
}) {
  const [drafts, setDrafts] = useState<string[]>(post.ideas.map((i) => i.text));
  const done = ideasDone(post.ideas);
  const ready = isReady(post.ideas);
  const posted = !!post.postedAt;

  function commitText(i: number) {
    const text = drafts[i].trim();
    if (text === post.ideas[i].text) return;
    const ideas = post.ideas.map((idea, k) => (k === i ? { text, done: idea.done && text.length > 0 } : idea));
    onIdeas(post, ideas);
  }
  function toggle(i: number) {
    const text = drafts[i].trim();
    if (!text) return;
    const ideas = post.ideas.map((idea, k) => (k === i ? { text, done: !idea.done } : idea));
    onIdeas(post, ideas);
  }

  return (
    <Card padding="md" className={cn(posted && "opacity-75")}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold uppercase tracking-tight text-ink-primary">{post.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {post.client && <Badge tone="info" size="xs">{post.client.name}</Badge>}
            {posted ? (
              <Badge tone="success" size="xs" dot>Posteado {fmt(post.postedAt)}</Badge>
            ) : ready ? (
              <Badge tone="success" size="xs" dot>Listo para postear</Badge>
            ) : (
              <Badge tone="neutral" size="xs">{done} de {IDEAS_PER_POST} ideas</Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => onEdit(post)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Eliminar" onClick={() => onDelete(post)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <ol className="space-y-2">
        {post.ideas.map((idea, i) => (
          <li key={i} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-2 h-4 w-4 shrink-0 accent-accent2"
              checked={idea.done}
              disabled={posted || !drafts[i].trim()}
              onChange={() => toggle(i)}
              aria-label={`Idea ${i + 1} lista`}
            />
            <Textarea
              rows={2}
              value={drafts[i]}
              placeholder={`Idea ${i + 1}`}
              disabled={posted}
              onChange={(e) => setDrafts((d) => d.map((t, k) => (k === i ? e.target.value : t)))}
              onBlur={() => commitText(i)}
              className={cn("min-h-[56px] resize-y text-sm", idea.done && "line-through text-ink-muted")}
            />
          </li>
        ))}
      </ol>

      {post.notes && <p className="mt-3 whitespace-pre-line text-xs text-ink-muted">{post.notes}</p>}

      <div className="mt-4 flex justify-end">
        {posted ? (
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={() => onPosted(post, false)}>
            Volver a preparación
          </Button>
        ) : (
          <Button size="sm" leftIcon={<Send className="h-4 w-4" />} disabled={!ready} onClick={() => onPosted(post, true)}>
            Ya posteamos
          </Button>
        )}
      </div>
    </Card>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "America/New_York" });
}

// ─── Create / edit modal ───────────────────────────────

type PostDraft = { title: string; clientId: string | null; ideas: SocialIdea[]; notes: string | null };

function PostModal({
  open,
  onOpenChange,
  post,
  clients,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: SocialPostItem | null;
  clients: ClientOption[];
  onSubmit: (draft: PostDraft) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(GENERAL);
  const [ideas, setIdeas] = useState<string[]>(["", "", ""]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setTitle(post?.title ?? "");
    setClientId(post?.clientId ?? GENERAL);
    setIdeas(post ? post.ideas.map((i) => i.text) : ["", "", ""]);
    setNotes(post?.notes ?? "");
    setSaving(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        clientId: clientId === GENERAL ? null : clientId,
        ideas: ideas.map((text, i) => ({ text: text.trim(), done: !!post?.ideas[i]?.done && text.trim().length > 0 })),
        notes: notes.trim() || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={post ? "Editar post" : "Nuevo post"} description="Un título y hasta 3 ideas. Puedes dejarlas en blanco y completarlas después.">
      <form onSubmit={submit} className="space-y-4">
        <FormGroup label="Título" htmlFor="sp-title">
          <Input id="sp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="NEXT POST MARKO" autoFocus required />
        </FormGroup>
        <FormGroup label="Cliente" htmlFor="sp-client">
          <Select id="sp-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value={GENERAL}>General (agencia)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormGroup>
        {ideas.map((text, i) => (
          <FormGroup key={i} label={`Idea ${i + 1}`} htmlFor={`sp-idea-${i}`}>
            <Textarea id={`sp-idea-${i}`} rows={2} value={text} onChange={(e) => setIdeas((d) => d.map((t, k) => (k === i ? e.target.value : t)))} />
          </FormGroup>
        ))}
        <FormGroup label="Notas" htmlFor="sp-notes">
          <Textarea id="sp-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </FormGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="submit" loading={saving} disabled={!title.trim()}>{post ? "Guardar" : "Crear"}</Button>
        </FormActions>
      </form>
    </Modal>
  );
}
