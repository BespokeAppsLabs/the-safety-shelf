"use client";

import { useState } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SOCIAL_PLATFORMS, SOCIAL_POST_STATUS, socialPlatformLabel } from "@/lib/social";

const selectClass =
  "w-full rounded-full border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary";

// Existing draft/published post: preview + regenerate + publish + delete.
function PostCard({ post }: { post: any }) {
  const regenerate = useAction(api.socialActions.regenerateSocialPost);
  const publish = useAction(api.socialActions.publishSocial);
  const remove = useMutation(api.social.deletePost);
  const [busy, setBusy] = useState<null | "regen" | "publish" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string>(post.content);

  const status = SOCIAL_POST_STATUS[post.status as keyof typeof SOCIAL_POST_STATUS] ?? SOCIAL_POST_STATUS.draft;
  const locked = post.status === "published";

  async function run(kind: "regen" | "publish" | "delete", fn: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="info">{socialPlatformLabel(post.platform)}</Badge>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="truncate text-xs text-muted">{post.bookTitle}</p>
      </div>

      <div className="flex gap-3">
        {post.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element — Convex storage URL.
          <img src={post.mediaUrl} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
        ) : (
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl border border-dashed border-border text-center text-xs text-muted">No cover</div>
        )}
        <Textarea
          className="min-h-24 flex-1"
          value={content}
          disabled={locked}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      {error ? <p className="text-xs font-semibold text-red-strong">{error}</p> : null}

      {!locked ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy !== null} onClick={() => void run("publish", () => publish({ postId: post._id as Id<"socialPosts"> }))}>
            {busy === "publish" ? "Publishing…" : "Publish"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run("regen", async () => {
            const res = await regenerate({ postId: post._id as Id<"socialPosts"> });
            setContent(res.content);
          })}>
            {busy === "regen" ? "Regenerating…" : "Regenerate"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run("delete", () => remove({ postId: post._id as Id<"socialPosts"> }))}>
            {busy === "delete" ? "Deleting…" : "Delete"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Published{post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleString()}` : ""}. Manage it in Postiz.</p>
      )}
    </Card>
  );
}

function ConnectedAccounts() {
  const accounts = useQuery(api.social.listAccounts, {});
  const connected = new Map((accounts ?? []).map((a) => [a.platform, a]));

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Connected accounts</p>
        <p className="mt-1 text-xs text-muted">
          Accounts are connected through your Postiz instance (it owns the platform OAuth apps). Once connected there, they appear here and become publish targets.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((p) => {
          const account = connected.get(p.value);
          return (
            <div key={p.value} className="flex items-center justify-between gap-2 rounded-2xl bg-background px-3 py-2">
              <span className="text-sm font-medium text-ink">{p.label}{!p.v1 ? " (later)" : ""}</span>
              {account ? (
                <Badge variant={account.status === "connected" ? "success" : "warning"}>{account.status}</Badge>
              ) : (
                <Badge variant="neutral">Not connected</Badge>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function AdminSocialScreen() {
  const { isAuthenticated } = useConvexAuth();
  const books = useQuery(api.books.listAll, isAuthenticated ? {} : "skip");
  const posts = useQuery(api.social.listPosts, isAuthenticated ? {} : "skip");
  const generate = useAction(api.socialActions.generateSocialPost);

  const [bookId, setBookId] = useState<string>("");
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "facebook", "x"]);
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBook = books?.find((b) => b._id === bookId) ?? books?.[0];

  function togglePlatform(value: string) {
    setPlatforms((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  }

  async function runGenerate() {
    if (!selectedBook) return;
    setBusy(true);
    setError(null);
    try {
      await generate({ bookId: selectedBook._id, platforms, instructions: instructions.trim() || undefined });
      setInstructions("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Social</h1>
        <p className="mt-1 text-sm text-muted">Generate posts for the store&rsquo;s social pages, review them, and publish through Postiz.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card className="space-y-4">
            <p className="text-sm font-semibold text-ink">Generate a post</p>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Book</span>
              <select className={selectClass} value={selectedBook?._id ?? ""} onChange={(e) => setBookId(e.target.value)}>
                {(books ?? []).map((book) => (
                  <option key={book._id} value={book._id}>{book.title}{book.status !== "live" ? ` (${book.status})` : ""}</option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Platforms</span>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePlatform(p.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      platforms.includes(p.value) ? "bg-primary text-white" : "bg-background text-muted hover:bg-mint/60"
                    }`}
                  >
                    {p.label}{!p.v1 ? " (later)" : ""}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Extra instructions (optional)</span>
              <Textarea className="min-h-20" placeholder="e.g. lead with the launch discount, mention it's for new parents." value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </label>

            {error ? <p className="text-sm font-semibold text-red-strong">{error}</p> : null}
            <Button size="sm" disabled={busy || !selectedBook || platforms.length === 0} onClick={() => void runGenerate()}>
              {busy ? "Generating…" : `Generate ${platforms.length || 0} post${platforms.length === 1 ? "" : "s"}`}
            </Button>
            <p className="text-xs text-muted">Copy is written by your connected text model; the book&rsquo;s cover is attached automatically. Nothing is published until you press Publish.</p>
          </Card>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">Posts</p>
            {posts === undefined ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : posts.length === 0 ? (
              <Card><p className="text-sm text-muted">No posts yet. Generate one above.</p></Card>
            ) : (
              posts.map((post) => <PostCard key={post._id} post={post} />)
            )}
          </div>
        </div>

        <ConnectedAccounts />
      </div>
    </div>
  );
}
