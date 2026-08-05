"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ChapterEditor } from "@/components/admin/ChapterEditor";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { blocksToChapters, chaptersToBlocks, type Chapter } from "@/lib/bookContent";
import { LANGUAGES, languageLabel } from "@/lib/languages";
import { isSavedTranslation } from "@/lib/translationState";

const selectClass =
  "rounded-full border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary";

function VariantEditor({ variant, onSaved }: { variant: Doc<"bookVariants">; onSaved: (lang: string) => void }) {
  const blocks = useQuery(api.variantBlocks.listByVariant, { variantId: variant._id });
  const updateVariant = useMutation(api.bookVariants.update);
  const setBlocks = useMutation(api.variantBlocks.setBlocks);
  const discardVariant = useMutation(api.bookVariants.discard);

  const [title, setTitle] = useState(variant.title ?? "");
  const [blurb, setBlurb] = useState(variant.blurb ?? "");
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (blocks && chapters === null) setChapters(blocksToChapters(blocks));
  }, [blocks, chapters]);

  async function save() {
    if (chapters === null) return;
    setSaving(true);
    setError(null);
    try {
      // Save blocks first: Read never exposes half-saved content.
      await setBlocks({ variantId: variant._id, blocks: chaptersToBlocks(chapters) });
      await updateVariant({ variantId: variant._id, title, blurb, isSaved: true });
      onSaved(variant.lang);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function discard() {
    setSaving(true);
    setError(null);
    try {
      await discardVariant({ variantId: variant._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-ink">Review {languageLabel(variant.lang)}</p>
        <p className="mt-1 text-xs text-muted">Save this translation to move it into admin Content.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Title</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Blurb</span>
          <Textarea className="min-h-0" rows={2} value={blurb} onChange={(e) => setBlurb(e.target.value)} />
        </label>
      </div>

      {chapters === null ? <p className="text-sm text-muted">Loading…</p> : <ChapterEditor chapters={chapters} onChange={setChapters} />}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={saving || chapters === null} onClick={() => void save()}>
          {saving ? "Saving…" : "Save translation"}
        </Button>
        {/* The way out of a translation you do not want. An unsaved draft blocks
            this book from being translated again, so without a discard the only
            exit from a bad translation was to save it. */}
        <Button size="sm" variant="ghost" disabled={saving} onClick={() => void discard()}>
          Discard
        </Button>
      </div>

      {error ? <p className="text-sm font-semibold text-red-strong">{error}</p> : null}
    </Card>
  );
}

export function TranslationsPanel({
  bookId,
  originalLang,
  onSaved,
}: {
  bookId: Id<"books">;
  originalLang: string;
  onSaved: (lang: string) => void;
}) {
  const variants = useQuery(api.bookVariants.list, { bookId });
  const translate = useAction(api.translate.translate);
  const pending = (variants ?? []).filter((variant) => !isSavedTranslation(variant));

  const [addLang, setAddLang] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taken = new Set([originalLang, ...(variants ?? []).map((v) => v.lang)]);
  const available = LANGUAGES.filter((l) => !taken.has(l.code));

  useEffect(() => {
    if (!addLang && available.length) setAddLang(available[0].code);
  }, [available, addLang]);

  async function add() {
    if (!addLang || pending.length) return;
    setAdding(true);
    setError(null);
    try {
      await translate({ bookId, lang: addLang });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  }

  const blocked = pending.length > 0;

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-ink">Add a language</p>
        <p className="text-xs text-muted">
          Auto-translates the original into a review draft. Save it before generating another translation. Original is {languageLabel(originalLang)}.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select className={selectClass} value={addLang} onChange={(e) => setAddLang(e.target.value)} disabled={blocked || !available.length}>
            {available.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
          <Button size="sm" disabled={adding || blocked || !available.length} onClick={() => void add()}>
            {adding ? "Translating…" : "Auto-translate"}
          </Button>
          {blocked ? <span className="text-xs text-muted">Save the translation below before adding another language.</span> : null}
          {!blocked && !available.length ? <span className="text-xs text-muted">All supported languages added.</span> : null}
        </div>
        {error ? <p className="text-sm font-semibold text-red-strong">{error}</p> : null}
      </Card>

      {variants === undefined ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-muted">No translations waiting to be saved.</p>
      ) : (
        pending.map((variant) => <VariantEditor key={variant._id} variant={variant} onSaved={onSaved} />)
      )}
    </div>
  );
}
