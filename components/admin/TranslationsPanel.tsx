"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ChapterEditor } from "@/components/admin/ChapterEditor";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { blocksToChapters, chaptersToBlocks, type Chapter } from "@/lib/bookContent";
import { LANGUAGES, languageLabel } from "@/lib/languages";

const selectClass =
  "rounded-full border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary";

function VariantEditor({ variant }: { variant: Doc<"bookVariants"> }) {
  const blocks = useQuery(api.variantBlocks.listByVariant, { variantId: variant._id });
  const translate = useAction(api.translate.translate);
  const updateVariant = useMutation(api.bookVariants.update);
  const setBlocks = useMutation(api.variantBlocks.setBlocks);

  const [title, setTitle] = useState(variant.title ?? "");
  const [blurb, setBlurb] = useState(variant.blurb ?? "");
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [busy, setBusy] = useState<null | "save" | "translate" | "publish">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (blocks && chapters === null) setChapters(blocksToChapters(blocks));
  }, [blocks, chapters]);

  async function run(kind: "save" | "translate" | "publish", fn: () => Promise<unknown>) {
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
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">{languageLabel(variant.lang)}</p>
          <Badge variant={variant.status === "live" ? "success" : "info"}>{variant.status}</Badge>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void run("translate", () => translate({ bookId: variant.bookId, lang: variant.lang }))}
          >
            {busy === "translate" ? "Translating…" : "Auto-translate (overwrite)"}
          </Button>
          <Button
            size="sm"
            variant={variant.status === "live" ? "ghost" : "primary"}
            disabled={busy !== null}
            onClick={() =>
              void run("publish", () =>
                updateVariant({ variantId: variant._id, status: variant.status === "live" ? "draft" : "live" }),
              )
            }
          >
            {variant.status === "live" ? "Unpublish" : "Publish"}
          </Button>
        </div>
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

      {chapters === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <ChapterEditor chapters={chapters} onChange={setChapters} />
      )}

      <div>
        <Button
          size="sm"
          disabled={busy !== null || chapters === null}
          onClick={() =>
            void run("save", async () => {
              await updateVariant({ variantId: variant._id, title, blurb });
              await setBlocks({ variantId: variant._id, blocks: chaptersToBlocks(chapters ?? []) });
            })
          }
        >
          {busy === "save" ? "Saving…" : "Save translation"}
        </Button>
      </div>

      {error ? <p className="text-sm font-semibold text-red-strong">{error}</p> : null}
    </Card>
  );
}

export function TranslationsPanel({ bookId, originalLang }: { bookId: Id<"books">; originalLang: string }) {
  const variants = useQuery(api.bookVariants.list, { bookId });
  const translate = useAction(api.translate.translate);

  const [addLang, setAddLang] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taken = new Set([originalLang, ...(variants ?? []).map((v) => v.lang)]);
  const available = LANGUAGES.filter((l) => !taken.has(l.code));

  useEffect(() => {
    if (!addLang && available.length) setAddLang(available[0].code);
  }, [available, addLang]);

  async function add() {
    if (!addLang) return;
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

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-ink">Add a language</p>
        <p className="text-xs text-muted">
          Auto-translates the original with your connected AI provider into an editable draft. Original is{" "}
          {languageLabel(originalLang)}.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select className={selectClass} value={addLang} onChange={(e) => setAddLang(e.target.value)} disabled={!available.length}>
            {available.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
          <Button size="sm" disabled={adding || !available.length} onClick={() => void add()}>
            {adding ? "Translating…" : "Auto-translate"}
          </Button>
          {!available.length ? <span className="text-xs text-muted">All supported languages added.</span> : null}
        </div>
        {error ? <p className="text-sm font-semibold text-red-strong">{error}</p> : null}
      </Card>

      {variants === undefined ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : variants.length === 0 ? (
        <p className="text-sm text-muted">No translations yet.</p>
      ) : (
        variants.map((variant) => <VariantEditor key={variant._id} variant={variant} />)
      )}
    </div>
  );
}
