"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ApprovalControls } from "@/components/admin/ApprovalControls";
import { ChapterEditor } from "@/components/admin/ChapterEditor";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  blocksToChapters,
  editorChaptersToParagraphs,
  paragraphChaptersToEditor,
  type Chapter,
  type ParagraphChapter,
} from "@/lib/bookContent";

function ChapterReader({ chapters }: { chapters: Chapter[] }) {
  return (
    <div className="space-y-5">
      {chapters.map((chapter, index) => (
        <div key={index} className="space-y-3">
          {chapter.heading ? <h3 className="text-xl font-semibold text-ink">{chapter.heading}</h3> : null}
          {chapter.body.split(/\n\s*\n/).filter(Boolean).map((para, pi) => (
            <p key={pi} className="text-sm leading-7 text-muted">{para}</p>
          ))}
        </div>
      ))}
      {chapters.length === 0 ? <p className="text-sm text-muted">No content yet.</p> : null}
    </div>
  );
}

// publishBook has nothing unsaved to edit — the book already exists — so the
// review is a read-only render of its current content.
function PublishReview({ bookId }: { bookId: Id<"books"> }) {
  const book = useQuery(api.books.getById, { bookId });
  const blocks = useQuery(api.bookBlocks.listByBook, { bookId });

  if (book === undefined || blocks === undefined) return <p className="text-sm text-muted">Loading draft…</p>;
  if (!book) return <p className="text-sm font-semibold text-red-strong">That book no longer exists.</p>;

  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold text-ink">{book.title}</h2>
        <p className="mt-1 text-sm text-muted">{book.blurb}</p>
      </div>
      <ChapterReader chapters={blocksToChapters(blocks)} />
    </>
  );
}

// editBook — the proposal changes a book that already exists, so the review
// shows what will change and, when content is being replaced, the full text
// that will overwrite the current chapters.
function EditBookReview({ action }: { action: Doc<"agentActions"> }) {
  const args = (action.args ?? {}) as {
    bookId: Id<"books">;
    title?: string;
    newTitle?: string;
    blurb?: string;
    author?: string;
    ageGroup?: string;
    priceCents?: number;
    chapters?: ParagraphChapter[];
  };
  const book = useQuery(api.books.getById, { bookId: args.bookId });
  const blocks = useQuery(api.bookBlocks.listByBook, { bookId: args.bookId });

  const fields: [string, string | undefined][] = [
    ["Title", args.newTitle],
    ["Blurb", args.blurb],
    ["Author", args.author],
    ["Age group", args.ageGroup],
    ["Price", args.priceCents !== undefined ? `${(args.priceCents / 100).toFixed(2)}` : undefined],
  ];
  const changed = fields.filter(([, value]) => value !== undefined);
  const currentChapters = blocks ? blocksToChapters(blocks) : [];

  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold text-ink">{book?.title ?? args.title}</h2>
        <p className="mt-1 text-sm text-muted">
          Updates this existing {book?.status ?? "draft"} book in place — same page, same buyers. No new book is created.
        </p>
      </div>

      {changed.length ? (
        <div className="space-y-2 rounded-3xl bg-background p-4">
          {changed.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
              <p className="text-sm text-ink">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {args.chapters ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Replaces all content · {currentChapters.length} → {args.chapters.length} chapters
          </p>
          <ChapterReader chapters={paragraphChaptersToEditor(args.chapters)} />
        </div>
      ) : (
        <p className="text-sm text-muted">Content is unchanged — metadata only.</p>
      )}
    </>
  );
}

// writeBook draft — still only args on the proposal, so it is fully editable
// until approval turns it into a book.
function WriteBookReview({ action }: { action: Doc<"agentActions"> }) {
  const args = (action.args ?? {}) as {
    title?: string;
    blurb?: string;
    priceCents?: number;
    chapters?: ParagraphChapter[];
  };
  const updateArgs = useMutation(api.agentActions.updateArgs);

  const [title, setTitle] = useState(args.title ?? "");
  const [blurb, setBlurb] = useState(args.blurb ?? "");
  const [priceDollars, setPriceDollars] = useState(((args.priceCents ?? 0) / 100).toFixed(2));
  const [chapters, setChapters] = useState<Chapter[]>(paragraphChaptersToEditor(args.chapters ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edited = {
    title: title.trim(),
    blurb,
    priceCents: Math.round(parseFloat(priceDollars || "0") * 100),
    chapters: editorChaptersToParagraphs(chapters),
  };
  const dirty =
    JSON.stringify(edited) !==
    JSON.stringify({
      title: (args.title ?? "").trim(),
      blurb: args.blurb ?? "",
      priceCents: args.priceCents ?? 0,
      chapters: editorChaptersToParagraphs(paragraphChaptersToEditor(args.chapters ?? [])),
    });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateArgs({ actionId: action._id, ...edited });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Title</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Price</span>
          <Input inputMode="decimal" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Blurb</span>
        <Textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} />
      </label>

      <ChapterEditor chapters={chapters} onChange={setChapters} />

      {error ? <p className="text-sm font-semibold text-red-strong">{error}</p> : null}
      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button size="sm" variant="ghost" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
        {dirty ? (
          <p className="text-xs text-muted">Save your edits before approving — approval applies what is stored.</p>
        ) : null}
      </div>
      {dirty ? null : <ApprovalControls actionId={action._id} />}
    </>
  );
}

export function ReviewProposalDialog({ action, onClose }: { action: Doc<"agentActions">; onClose: () => void }) {
  const bookId = (action.args as { bookId?: Id<"books"> } | undefined)?.bookId;

  return (
    <Dialog open onClose={onClose}>
      <Card className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Review · {action.tool}</p>
          <button onClick={onClose} className="text-sm font-semibold text-muted hover:text-ink">
            Close
          </button>
        </div>

        {action.tool === "writeBook" ? (
          <WriteBookReview action={action} />
        ) : action.tool === "editBook" ? (
          <>
            <EditBookReview action={action} />
            <ApprovalControls actionId={action._id} />
          </>
        ) : bookId ? (
          <>
            <PublishReview bookId={bookId} />
            <ApprovalControls actionId={action._id} />
          </>
        ) : (
          <p className="text-sm text-muted">Nothing to preview for this proposal.</p>
        )}
      </Card>
    </Dialog>
  );
}
