"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { ChapterEditor } from "@/components/admin/ChapterEditor";
import { TranslationsPanel } from "@/components/admin/TranslationsPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { blocksToChapters, chaptersToBlocks, type Chapter } from "@/lib/bookContent";
import { DEFAULT_ELEVENLABS_MODEL, ELEVENLABS_MODELS, type ElevenLabsModel } from "@/lib/elevenlabs";
import { languageLabel } from "@/lib/languages";
import { isSavedTranslation } from "@/lib/translationState";

const selectClass =
  "w-full rounded-full border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary";

const AUDIO_STATUS = {
  generating: { label: "Generating…", variant: "info" as const },
  ready: { label: "Ready", variant: "success" as const },
  failed: { label: "Failed", variant: "danger" as const },
};

// One <audio> that plays the chapters as a continuous audiobook: auto-advances
// on end, with a clickable chapter list. No server-side merge.
function AudiobookPlayer({ tracks }: { tracks: { chapter: number; url: string | null }[] }) {
  const playable = tracks.filter((t): t is { chapter: number; url: string } => Boolean(t.url));
  const audioRef = useRef<HTMLAudioElement>(null);
  const shouldPlay = useRef(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.load();
    if (shouldPlay.current) void el.play().catch(() => {});
    shouldPlay.current = false;
  }, [index]);

  if (!playable.length) return null;
  const current = playable[Math.min(index, playable.length - 1)];

  function jump(i: number) {
    shouldPlay.current = true;
    setIndex(i);
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <audio
        ref={audioRef}
        src={current.url}
        controls
        preload="none"
        className="w-full"
        onEnded={() => {
          if (index < playable.length - 1) jump(index + 1);
        }}
      />
      <div className="flex flex-wrap gap-2">
        {playable.map((track, i) => (
          <button
            key={track.chapter}
            onClick={() => jump(i)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              i === index ? "bg-primary text-white" : "bg-background text-muted hover:bg-mint/60"
            }`}
          >
            Ch. {track.chapter}
          </button>
        ))}
      </div>
    </div>
  );
}

// Narration for ONE language of a book.
function AudiobookCard({
  bookId,
  lang,
  audioStatus,
}: {
  bookId: Id<"books">;
  lang: string;
  audioStatus?: "generating" | "ready" | "failed";
}) {
  const audio = useQuery(api.bookAudio.listForBook, { bookId, lang });
  const voices = useQuery(api.voices.list, {});
  const generate = useAction(api.audiobook.generate);
  const syncVoices = useAction(api.voices.actions.sync.sync);

  const [model, setModel] = useState<ElevenLabsModel>(DEFAULT_ELEVENLABS_MODEL);
  const [voiceId, setVoiceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limit = ELEVENLABS_MODELS[model].maxChars;
  const status = audioStatus ? AUDIO_STATUS[audioStatus] : null;

  useEffect(() => {
    if (!voiceId && voices && voices.length) setVoiceId(voices[0].voiceId);
  }, [voices, voiceId]);

  const selectedVoice = voices?.find((v) => v.voiceId === voiceId);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await generate({ bookId, model, voiceId: voiceId.trim() || undefined, lang });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      await syncVoices({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Narration · {languageLabel(lang)}</p>
        {status ? <Badge variant={status.variant}>{status.label}</Badge> : <Badge>Not generated</Badge>}
      </div>
      <p className="text-xs text-muted">
        Narrated with ElevenLabs from the saved content for this language — one request per chapter, spending real credits.
        Each chapter must stay under the selected model&rsquo;s {limit.toLocaleString()}-character limit.
      </p>

      {voices && voices.length === 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-3xl bg-background px-4 py-3">
          <p className="text-xs text-muted">No voices loaded yet.</p>
          <Button size="sm" variant="ghost" disabled={syncing} onClick={() => void sync()}>
            {syncing ? "Syncing…" : "Sync voices"}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid items-end gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Model</span>
              <select className={selectClass} value={model} onChange={(e) => setModel(e.target.value as ElevenLabsModel)}>
                {Object.entries(ELEVENLABS_MODELS).map(([id, m]) => (
                  <option key={id} value={id}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Voice</span>
              <select className={selectClass} value={voiceId} onChange={(e) => setVoiceId(e.target.value)} disabled={!voices}>
                {(voices ?? []).map((voice) => (
                  <option key={voice.voiceId} value={voice.voiceId}>{voice.name}</option>
                ))}
              </select>
            </label>
          </div>

          {selectedVoice ? (
            <div className="rounded-3xl bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{selectedVoice.name}</p>
                {selectedVoice.category ? <Badge>{selectedVoice.category}</Badge> : null}
              </div>
              {selectedVoice.description ? <p className="mt-1 text-xs text-muted">{selectedVoice.description}</p> : null}
              {selectedVoice.previewUrl ? (
                <audio controls preload="none" src={selectedVoice.previewUrl} className="mt-2 h-9 w-full" />
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <div className="flex items-center gap-3">
        <Button size="sm" disabled={busy || audioStatus === "generating" || !voiceId} onClick={() => void run()}>
          {busy || audioStatus === "generating" ? "Generating…" : audio && audio.length ? "Regenerate" : "Generate audiobook"}
        </Button>
        {voices && voices.length > 0 ? (
          <button onClick={() => void sync()} disabled={syncing} className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">
            {syncing ? "Syncing…" : "Sync voices"}
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm font-semibold text-red-strong">{error}</p> : null}
      {audio && audio.length ? <AudiobookPlayer tracks={audio} /> : null}
    </Card>
  );
}

// Audio tab: pick a language (original + translated variants), narrate each.
function AudioTab({ book }: { book: Doc<"books"> }) {
  const variants = useQuery(api.bookVariants.list, { bookId: book._id });
  const [lang, setLang] = useState(book.originalLang);

  const savedVariants = (variants ?? []).filter(isSavedTranslation);
  const langs = [book.originalLang, ...savedVariants.map((v) => v.lang)];
  const audioStatus =
    lang === book.originalLang ? book.audioStatus : savedVariants.find((v) => v.lang === lang)?.audioStatus;

  return (
    <div className="space-y-4">
      <label className="block max-w-xs">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Language</span>
        <select className={selectClass} value={lang} onChange={(e) => setLang(e.target.value)}>
          {langs.map((code) => (
            <option key={code} value={code}>
              {languageLabel(code)}{code === book.originalLang ? " (original)" : ""}
            </option>
          ))}
        </select>
      </label>
      <AudiobookCard bookId={book._id} lang={lang} audioStatus={audioStatus} />
    </div>
  );
}

function ContentTab({
  book,
  originalChapters,
  onOriginalChange,
}: {
  book: Doc<"books">;
  originalChapters: Chapter[];
  onOriginalChange: (chapters: Chapter[]) => void;
}) {
  const variants = useQuery(api.bookVariants.list, { bookId: book._id });
  const setOriginalBlocks = useMutation(api.bookBlocks.setBlocks);
  const setVariantBlocks = useMutation(api.variantBlocks.setBlocks);
  const [lang, setLang] = useState(book.originalLang);
  const [editedVariantChapters, setEditedVariantChapters] = useState<Chapter[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedVariants = (variants ?? []).filter(isSavedTranslation);
  const selectedVariant = savedVariants.find((variant) => variant.lang === lang);
  const variantBlocks = useQuery(
    api.variantBlocks.listByVariant,
    selectedVariant ? { variantId: selectedVariant._id } : "skip",
  );
  const sourceChapters = lang === book.originalLang ? originalChapters : variantBlocks ? blocksToChapters(variantBlocks) : null;
  const chapters = lang === book.originalLang ? originalChapters : editedVariantChapters ?? sourceChapters;

  useEffect(() => {
    if (lang !== book.originalLang && !selectedVariant && variants !== undefined) setLang(book.originalLang);
  }, [book.originalLang, lang, selectedVariant, variants]);

  async function save() {
    if (!chapters) return;
    setSaving(true);
    setError(null);
    try {
      if (lang === book.originalLang) {
        await setOriginalBlocks({ bookId: book._id, blocks: chaptersToBlocks(chapters) });
      } else if (selectedVariant) {
        await setVariantBlocks({ variantId: selectedVariant._id, blocks: chaptersToBlocks(chapters) });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4">
      <label className="block max-w-xs">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Content language</span>
        <select className={selectClass} value={lang} onChange={(e) => {
          setEditedVariantChapters(null);
          setLang(e.target.value);
        }}>
          <option value={book.originalLang}>{languageLabel(book.originalLang)} (original)</option>
          {savedVariants.map((variant) => (
            <option key={variant._id} value={variant.lang}>{languageLabel(variant.lang)}</option>
          ))}
        </select>
      </label>
      <p className="text-sm font-semibold text-ink">{languageLabel(lang)} content</p>
      {chapters === null ? <p className="text-sm text-muted">Loading translation…</p> : <ChapterEditor chapters={chapters} onChange={lang === book.originalLang ? onOriginalChange : setEditedVariantChapters} />}
      <div>
        <Button size="sm" disabled={saving || chapters === null || (lang !== book.originalLang && !selectedVariant)} onClick={() => void save()}>
          {saving ? "Saving…" : `Save ${languageLabel(lang)} content`}
        </Button>
      </div>
      {error ? <p className="text-sm font-semibold text-red-strong">{error}</p> : null}
    </Card>
  );
}

function ReadTab({
  book,
  originalChapters,
  lang,
  onLangChange,
}: {
  book: Doc<"books">;
  originalChapters: Chapter[];
  lang: string;
  onLangChange: (lang: string) => void;
}) {
  const variants = useQuery(api.bookVariants.list, { bookId: book._id });
  const savedVariants = (variants ?? []).filter(isSavedTranslation);
  const selectedVariant = savedVariants.find((variant) => variant.lang === lang);
  const variantBlocks = useQuery(
    api.variantBlocks.listByVariant,
    selectedVariant ? { variantId: selectedVariant._id } : "skip",
  );

  useEffect(() => {
    if (lang !== book.originalLang && !selectedVariant && variants !== undefined) onLangChange(book.originalLang);
  }, [book.originalLang, lang, onLangChange, selectedVariant, variants]);

  const chapters = lang === book.originalLang ? originalChapters : variantBlocks ? blocksToChapters(variantBlocks) : null;
  const title = selectedVariant?.title ?? book.title;

  return (
    <Card className="mx-auto max-w-3xl space-y-5">
      <label className="block max-w-xs">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Read language</span>
        <select className={selectClass} value={lang} onChange={(e) => onLangChange(e.target.value)}>
          <option value={book.originalLang}>{languageLabel(book.originalLang)} (original)</option>
          {savedVariants.map((variant) => (
            <option key={variant._id} value={variant.lang}>{languageLabel(variant.lang)}</option>
          ))}
        </select>
      </label>
      {chapters === null ? <p className="text-sm text-muted">Loading translation…</p> : <>
        <h1 className="text-4xl font-semibold tracking-tight text-ink">{title}</h1>
        {chapters.map((chapter, index) => (
          <div key={index} className="space-y-4">
            {chapter.heading ? <h2 className="pt-4 text-2xl font-semibold text-ink">{chapter.heading}</h2> : null}
            {chapter.imageUrl ? <img src={chapter.imageUrl} alt="" className="aspect-square w-full rounded-3xl object-cover" /> : null}
            {chapter.body.split(/\n\s*\n/).filter(Boolean).map((para, pi) => (
              <p key={pi} className="text-base leading-8 text-muted">{para}</p>
            ))}
          </div>
        ))}
        <p className="pt-6 text-center text-sm italic text-muted">— end of guide —</p>
      </>}
    </Card>
  );
}

type Meta = {
  title: string;
  author: string;
  blurb: string;
  priceDollars: string;
  categoryId: string;
  ageGroup: string;
  status: "draft" | "live" | "archived";
  kind: "guide" | "storybook";
};

type Tab = "details" | "content" | "images" | "translations" | "audio" | "read";
const TABS: { id: Tab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "content", label: "Content" },
  { id: "images", label: "Images" },
  { id: "translations", label: "Translations" },
  { id: "audio", label: "Audio" },
  { id: "read", label: "Read" },
];

export function AdminBookEditor({
  slug,
  bookId,
  initialTab = "details",
}: {
  slug?: string;
  bookId?: Id<"books">;
  initialTab?: Tab;
}) {
  const { isAuthenticated } = useConvexAuth();
  const bookBySlug = useQuery(api.books.getAnyBySlug, isAuthenticated && slug ? { slug } : "skip");
  const bookById = useQuery(api.books.getById, isAuthenticated && bookId ? { bookId } : "skip");
  const book = bookId ? bookById : bookBySlug;
  const categories = useQuery(api.categories.list, isAuthenticated ? {} : "skip");
  const blocks = useQuery(api.bookBlocks.listByBook, book ? { bookId: book._id } : "skip");
  const aiStatus = useQuery(api.aiCredentials.getStatus, isAuthenticated ? {} : "skip");
  const updateBook = useMutation(api.books.update);
  const generateCover = useAction(api.images.generateCover);
  const generateChapterImage = useAction(api.images.generateChapterImage);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [readLang, setReadLang] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [generatingChapter, setGeneratingChapter] = useState<number | null>(null);
  const [coverCost, setCoverCost] = useState<number | null | undefined>(undefined);
  const [chapterCosts, setChapterCosts] = useState<Record<number, number | null>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (book && meta === null) {
      setMeta({
        title: book.title,
        author: book.author,
        blurb: book.blurb,
        priceDollars: (book.priceCents / 100).toFixed(2),
        categoryId: book.categoryId,
        ageGroup: book.ageGroup,
        status: book.status,
        kind: book.kind ?? "guide",
      });
    }
  }, [book, meta]);

  useEffect(() => {
    if (blocks && chapters === null) setChapters(blocksToChapters(blocks));
  }, [blocks, chapters]);

  if (book === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (book === null) return <p className="text-sm text-muted">Book not found.</p>;
  if (!meta || chapters === null) return <p className="text-sm text-muted">Loading…</p>;

  async function saveMeta() {
    if (!meta || !book) return;
    setSavingMeta(true);
    setError(null);
    try {
      await updateBook({
        bookId: book._id,
        title: meta.title,
        author: meta.author,
        blurb: meta.blurb,
        priceCents: Math.round(parseFloat(meta.priceDollars || "0") * 100),
        categoryId: meta.categoryId as (typeof book)["categoryId"],
        ageGroup: meta.ageGroup,
        status: meta.status,
        kind: meta.kind,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingMeta(false);
    }
  }

  async function runCoverGeneration() {
    if (!book) return;
    setGeneratingCover(true);
    setError(null);
    try {
      const result = await generateCover({ bookId: book._id });
      setCoverCost(result.actualCostUsd);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingCover(false);
    }
  }

  async function runChapterImage(index: number) {
    if (!book || !chapters) return;
    const chapter = index + 1;
    setGeneratingChapter(chapter);
    setError(null);
    try {
      const result = await generateChapterImage({ bookId: book._id, chapter });
      setChapters(chapters.map((c, i) => i === index ? { ...c, imageStorageId: result.storageId, imageUrl: result.url } : c));
      setChapterCosts({ ...chapterCosts, [chapter]: result.actualCostUsd });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingChapter(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/books" className="text-sm font-semibold text-primary">← Catalog</Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{meta.title || "Untitled"}</h1>
        <p className="mt-1 text-sm text-muted">
          /{book.slug} · {languageLabel(book.originalLang)} · <Badge variant={book.status === "live" ? "success" : "info"}>{book.status}</Badge>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm font-semibold text-red-strong">{error}</p> : null}

      {tab === "details" ? (
        <Card className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Title</span>
              <Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Author</span>
              <Input value={meta.author} onChange={(e) => setMeta({ ...meta, author: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Price (USD)</span>
              <Input inputMode="decimal" value={meta.priceDollars} onChange={(e) => setMeta({ ...meta, priceDollars: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Age group</span>
              <Input value={meta.ageGroup} onChange={(e) => setMeta({ ...meta, ageGroup: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Category</span>
              <select className={selectClass} value={meta.categoryId} onChange={(e) => setMeta({ ...meta, categoryId: e.target.value })}>
                {(categories ?? []).map((category) => (
                  <option key={category._id} value={category._id}>{category.title}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Status</span>
              <select className={selectClass} value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value as Meta["status"] })}>
                <option value="draft">draft</option>
                <option value="live">live</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Book kind</span>
              <select className={selectClass} value={meta.kind} onChange={(e) => setMeta({ ...meta, kind: e.target.value as Meta["kind"] })}>
                <option value="guide">guide</option>
                <option value="storybook">storybook</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Blurb</span>
            <Textarea className="min-h-24" value={meta.blurb} onChange={(e) => setMeta({ ...meta, blurb: e.target.value })} />
          </label>
          <div className="grid gap-4 rounded-3xl bg-background p-4 md:grid-cols-[12rem_1fr]">
            <div
              className="relative aspect-square overflow-hidden rounded-3xl text-white"
              style={{ backgroundImage: book.coverUrl ? undefined : `linear-gradient(150deg, ${book.gradientFrom ?? "#147a5c"}, ${book.gradientTo ?? "#2f7dbd"})` }}
            >
              {book.coverUrl ? <img src={book.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
              <p className="absolute bottom-4 left-4 right-4 text-sm font-semibold">{meta.title}</p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-ink">Cover image</p>
              <p className="text-sm text-muted">Generated with OpenRouter.</p>
              <Button size="sm" variant="ghost" disabled={generatingCover || !aiStatus?.openrouter} onClick={() => void runCoverGeneration()}>
                {generatingCover ? "Generating…" : `${book.coverStorageId ? "Regenerate" : "Generate"} cover`}
              </Button>
              {coverCost !== undefined ? <p className="text-xs text-muted">Actual cost: {coverCost === null ? "not reported" : `$${coverCost.toFixed(4)}`}</p> : null}
            </div>
          </div>
          <div>
            <Button size="sm" disabled={savingMeta} onClick={() => void saveMeta()}>
              {savingMeta ? "Saving…" : "Save details"}
            </Button>
          </div>
        </Card>
      ) : null}

      {tab === "content" ? <ContentTab book={book} originalChapters={chapters} onOriginalChange={setChapters} /> : null}

      {tab === "images" ? (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Page and chapter images</p>
              <p className="mt-1 text-xs text-muted">One generated image is attached to each chapter/page block. Save content after regenerating if you changed chapter structure.</p>
            </div>
            {!aiStatus?.openrouter ? <p className="text-sm text-muted">Connect OpenRouter in Settings first.</p> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {chapters.map((chapter, index) => {
              const chapterNo = index + 1;
              return (
                <div key={index} className="space-y-3 rounded-3xl bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">Page {chapterNo}{chapter.heading ? ` · ${chapter.heading}` : ""}</p>
                    {chapter.imageStorageId ? <Badge variant="success">Image set</Badge> : <Badge variant="warning">Missing</Badge>}
                  </div>
                  {chapter.imageUrl ? <img src={chapter.imageUrl} alt="" className="aspect-square w-full rounded-3xl object-cover" /> : (
                    <div className="flex aspect-square items-center justify-center rounded-3xl border border-dashed border-border bg-white text-sm text-muted">No image yet</div>
                  )}
                  <Button size="sm" variant="ghost" disabled={generatingChapter === chapterNo || !aiStatus?.openrouter} onClick={() => void runChapterImage(index)}>
                    {generatingChapter === chapterNo ? "Generating…" : `${chapter.imageStorageId ? "Regenerate" : "Generate"} page image`}
                  </Button>
                  {chapterNo in chapterCosts ? <p className="text-xs text-muted">Actual cost: {chapterCosts[chapterNo] === null ? "not reported" : `$${chapterCosts[chapterNo].toFixed(4)}`}</p> : null}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {tab === "translations" ? <TranslationsPanel bookId={book._id} originalLang={book.originalLang} onSaved={(lang) => {
        setReadLang(lang);
        setTab("read");
      }} /> : null}

      {tab === "audio" ? <AudioTab book={book} /> : null}

      {tab === "read" ? <ReadTab book={book} originalChapters={chapters} lang={readLang || book.originalLang} onLangChange={setReadLang} /> : null}
    </div>
  );
}
