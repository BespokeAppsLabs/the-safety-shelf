"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ComponentType } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { agentImageUrl } from "@/lib/agentImage";
import { BasePrice } from "@/components/store/Price";
import { ProposalActions } from "@/components/admin/ProposalActions";
import { translationReviewState } from "@/lib/translationState";

// Where a card link opens, decided by destination rather than by which card
// drew it. Anything outside /admin — the storefront, the reader, an external
// source — is a different workspace, and following it in place drops the owner
// out of the conversation they were having. Admin paths stay in this tab, since
// moving the owner around the admin app is exactly what the navigate tool is
// for.
function tabProps(href: string) {
  return href.startsWith("/admin") ? {} : { target: "_blank", rel: "noreferrer" };
}

// Cover art: real cover image when one's been uploaded (coverUrl), otherwise
// the gradient placeholder every book already has — same fallback ProductCard
// uses on the storefront.
function CoverThumb({
  coverUrl,
  gradientFrom,
  gradientTo,
  title,
}: {
  coverUrl?: string | null;
  gradientFrom?: string;
  gradientTo?: string;
  title: string;
}) {
  if (coverUrl) {
    return (
      <Image
        src={coverUrl}
        alt={title}
        width={48}
        height={48}
        className="h-12 w-12 shrink-0 rounded-xl object-cover"
      />
    );
  }
  return (
    <div
      className="h-12 w-12 shrink-0 rounded-xl"
      style={{ backgroundImage: `linear-gradient(140deg, ${gradientFrom ?? "#147a5c"}, ${gradientTo ?? "#2f7dbd"})` }}
    />
  );
}

export type BookStatsCardProps = {
  found: boolean;
  title?: string;
  slug?: string;
  status?: string;
  priceCents?: number;
  units?: number;
  revenueCents?: number;
  gradientFrom?: string;
  gradientTo?: string;
  coverUrl?: string | null;
};

export function BookStatsCard(props: BookStatsCardProps) {
  if (!props.found || !props.title) {
    return (
      <Card className="max-w-sm">
        <p className="text-sm text-muted">No book matched that title.</p>
      </Card>
    );
  }
  return (
    <Card className="max-w-sm">
      <div className="flex items-center gap-3">
        <CoverThumb coverUrl={props.coverUrl} gradientFrom={props.gradientFrom} gradientTo={props.gradientTo} title={props.title} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{props.title}</p>
          <Badge variant={props.status === "live" ? "success" : "warning"}>{props.status}</Badge>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Price</dt>
          <dd className="mt-1 text-sm font-semibold text-ink"><BasePrice cents={props.priceCents ?? 0} /></dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Units</dt>
          <dd className="mt-1 text-sm font-semibold text-ink">{props.units ?? 0}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Revenue</dt>
          <dd className="mt-1 text-sm font-semibold text-ink"><BasePrice cents={props.revenueCents ?? 0} /></dd>
        </div>
      </dl>
      {props.slug ? (
        <Link href={`/book/${props.slug}`} {...tabProps(`/book/${props.slug}`)} className="mt-4 block text-sm font-semibold text-primary">
          View storefront page ↗
        </Link>
      ) : null}
    </Card>
  );
}

export type TopSellersRow = {
  title: string;
  slug: string;
  status: string;
  units: number;
  revenueCents: number;
  gradientFrom?: string;
  gradientTo?: string;
  coverUrl?: string | null;
};

export function TopSellersTable({ rows }: { rows: TopSellersRow[] }) {
  if (!rows.length) {
    return (
      <Card className="max-w-md">
        <p className="text-sm text-muted">No sales yet.</p>
      </Card>
    );
  }
  return (
    <Card className="max-w-md">
      <p className="text-sm font-semibold text-ink">Top sellers</p>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <Link key={row.slug} href={`/book/${row.slug}`} {...tabProps(`/book/${row.slug}`)} className="flex items-center gap-3">
            <CoverThumb coverUrl={row.coverUrl} gradientFrom={row.gradientFrom} gradientTo={row.gradientTo} title={row.title} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{row.title}</p>
              <p className="text-xs text-muted">{row.units} units · <BasePrice cents={row.revenueCents} /></p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export function RevenueStatsCard({ totalUnits, totalRevenueCents }: { totalUnits: number; totalRevenueCents: number }) {
  return (
    <Card className="max-w-xs">
      <p className="text-sm font-semibold text-ink">Catalog revenue (all-time)</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Units</dt>
          <dd className="mt-1 text-lg font-semibold text-ink">{totalUnits}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Revenue</dt>
          <dd className="mt-1 text-lg font-semibold text-ink"><BasePrice cents={totalRevenueCents} /></dd>
        </div>
      </div>
    </Card>
  );
}

export function NavigateCard({ href, label }: { href: string; label: string }) {
  return (
    <Card className="max-w-xs">
      <p className="text-sm text-muted">The agent found a page for you:</p>
      <Link
        href={href}
        {...tabProps(href)}
        className="mt-3 inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong"
      >
        {label} {href.startsWith("/admin") ? "→" : "↗"}
      </Link>
    </Card>
  );
}

export function WebResearchCard({
  query,
  sources,
}: {
  query: string;
  sources: { title: string; url: string; description?: string }[];
}) {
  return (
    <Card className="max-w-md">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Web research</p>
      <p className="mt-2 text-sm font-semibold text-ink">{query}</p>
      <div className="mt-3 space-y-3">
        {sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block text-sm">
            <p className="font-semibold text-primary">{source.title} ↗</p>
            {source.description ? <p className="mt-1 text-xs text-muted">{source.description}</p> : null}
          </a>
        ))}
      </div>
    </Card>
  );
}

// A finished translation, handed back to the conversation that requested it.
//
// Saving moves a variant into admin Content, so it stays an explicit act — and
// deliberately a shallow one here. The chapter-level editor lives in the
// Translations tab; duplicating it inside a chat bubble would be a second copy
// of the same screen to keep in step. This card covers the common case (the
// title and blurb read correctly, accept it) and routes anything deeper to the
// editor that already exists.
export function TranslationReviewCard({
  variantId,
  bookId,
  lang,
  language,
  bookTitle,
  title,
  blurb,
  chapters,
}: {
  variantId: string;
  bookId: string;
  lang: string;
  language: string;
  bookTitle: string;
  title: string;
  blurb: string;
  chapters: number;
}) {
  const updateVariant = useMutation(api.bookVariants.update);
  const discardVariant = useMutation(api.bookVariants.discard);
  const [outcome, setOutcome] = useState<"saved" | "discarded" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, result: "saved" | "discarded") {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOutcome(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Where the translated text is actually readable depends on whether it has
  // been saved, and the two tabs split on exactly that: the Translations tab
  // lists only unsaved drafts, while Content renders saved variants. Linking to
  // one unconditionally is how "Review chapters" ended up showing the English
  // original — the default tab is Read, which always renders the source.
  // Read from the variant rather than from this component's own save state, so
  // the link is still right after a reload or a save made in the panel.
  const variants = useQuery(api.bookVariants.list, { bookId: bookId as Id<"books"> });
  const state = outcome ?? translationReviewState(variants, variantId);
  const reviewHref = state === "saved"
    ? `/admin/books/preview/${bookId}?tab=content&lang=${lang}`
    : `/admin/books/preview/${bookId}?tab=translations`;

  const save = () => run(() => updateVariant({ variantId: variantId as Id<"bookVariants">, isSaved: true }), "saved");
  // Discarding is not cosmetic: an unsaved draft blocks the book from being
  // translated again, so without this the only way out of a bad translation
  // was to save it.
  const discard = () => run(() => discardVariant({ variantId: variantId as Id<"bookVariants"> }), "discarded");

  return (
    <Card className="max-w-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        {language} translation · {state}
      </p>
      <p className="mt-2 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{blurb}</p>
      <p className="mt-2 text-xs text-muted">
        {chapters} chapter{chapters === 1 ? "" : "s"} translated from &ldquo;{bookTitle}&rdquo;.
      </p>
      {state === "saved" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-primary">
            Saved to admin Content in {language}. Readers still receive the original text.
          </p>
          <Link href={reviewHref} className="text-sm font-semibold text-primary">
            Review chapters →
          </Link>
        </div>
      ) : state === "discarded" ? (
        <p className="mt-3 text-sm font-semibold text-primary">Discarded. Nothing was published.</p>
      ) : state === "loading" ? (
        <p className="mt-3 text-sm text-muted">Checking translation status…</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={busy} onClick={() => void save()}>
            {busy ? "Working…" : "Save translation"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void discard()}>
            Discard
          </Button>
          <Link href={reviewHref} className="text-sm font-semibold text-primary">
            Review chapters →
          </Link>
        </div>
      )}
      {error ? <p className="mt-2 text-sm font-semibold text-red-strong">{error}</p> : null}
    </Card>
  );
}

// Generic proposal (e.g. publishBook) — a title, a one-line summary, controls.
export function ProposalCard({ actionId, title, summary }: { actionId: string; title: string; summary: string }) {
  return (
    <Card className="max-w-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Needs approval</p>
      <p className="mt-2 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{summary}</p>
      <ProposalActions actionId={actionId} />
    </Card>
  );
}

// writeBook proposal — draft metadata preview + controls. Approving saves it as
// a draft book (still not live; publishBook is a separate approval).
export function BookDraftCard({
  actionId,
  title,
  blurb,
  chapterCount,
  priceCents,
  category,
}: {
  actionId: string;
  title: string;
  blurb: string;
  chapterCount: number;
  priceCents: number;
  category: string;
}) {
  return (
    <Card className="max-w-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Draft book · needs approval</p>
      <p className="mt-2 text-lg font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{blurb}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{category}</Badge>
        <Badge variant="info">{chapterCount} chapter{chapterCount === 1 ? "" : "s"}</Badge>
        <Badge variant="success"><BasePrice cents={priceCents} /></Badge>
      </div>
      <ProposalActions actionId={actionId} />
    </Card>
  );
}


export function ImageGenerationProposalCard({
  actionId,
  target,
  bookId,
  chapter,
  title,
  prompt,
}: {
  actionId: string;
  target: "cover" | "page";
  bookId: string;
  chapter?: number;
  title: string;
  prompt: string;
}) {
  const id = actionId as Id<"agentActions">;
  const action = useQuery(api.agentActions.get, { actionId: id });
  const decide = useMutation(api.agentActions.decide);
  const complete = useMutation(api.agentActions.complete);
  const appendActionUpdate = useMutation(api.agentChats.appendActionUpdate);
  const generateCover = useAction(api.images.generateCover);
  const generateChapterImage = useAction(api.images.generateChapterImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const status = action?.status ?? "proposed";
  // Re-render the image after a page reload too: the executed action stores the
  // result URL, so a card that finished in an earlier session still shows it.
  const resultUrl = imageUrl ?? agentImageUrl(action?.result);

  async function approve() {
    setBusy(true);
    setError(null);
    let approved = false;
    try {
      await decide({ actionId: id, decision: "approved" });
      approved = true;
      const result = target === "cover"
        ? await generateCover({ bookId: bookId as Id<"books">, prompt })
        : await generateChapterImage({ bookId: bookId as Id<"books">, chapter: chapter ?? 1, prompt });
      setImageUrl(result.url ?? null);
      await complete({ actionId: id, status: "executed", result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      if (approved) {
        await complete({ actionId: id, status: "failed", result: { error: message } }).catch(() => {});
        await appendActionUpdate({ actionId: id, content: `I couldn’t generate the ${target === "cover" ? "cover" : `image for page ${chapter ?? 1}`} for “${title}”: ${message}` }).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setError(null);
    try {
      await decide({ actionId: id, decision: "rejected" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-md">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Image generation · needs approval</p>
      <p className="mt-2 text-sm font-semibold text-ink">{target === "cover" ? "Cover" : `Page ${chapter}`} · {title}</p>
      <div className="mt-3 rounded-xl bg-surface px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Generation prompt</p>
        <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted">{prompt}</p>
      </div>
      {status === "proposed" ? (
        <div className="mt-4 flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => void approve()}>{busy ? "Generating…" : "Approve & generate"}</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void reject()}>Reject</Button>
        </div>
      ) : (
        <div className="mt-4">
          <Badge variant={status === "executed" ? "success" : status === "rejected" ? "neutral" : "danger"}>
            {status === "executed" ? "Generated" : status === "rejected" ? "Rejected" : status}
          </Badge>
          {status === "executed" ? <p className="mt-2 text-xs text-muted">Actual cost: {(action?.result as { actualCostUsd?: number | null } | undefined)?.actualCostUsd == null ? "not reported" : `$${(action?.result as { actualCostUsd: number }).actualCostUsd.toFixed(4)}`}</p> : null}
        </div>
      )}
      {resultUrl ? (
        // eslint-disable-next-line @next/next/no-img-element — Convex storage URL, not a static asset.
        <img src={resultUrl} alt={`${target === "cover" ? "Cover" : `Page ${chapter}`} for ${title}`} className="mt-4 aspect-square w-full rounded-2xl object-cover" />
      ) : null}
      {error ? <p className="mt-2 text-xs font-semibold text-red-strong">{error}</p> : null}
    </Card>
  );
}

export function ImageBatchProposalCard({ actionId, bookId, title, chapters }: { actionId: string; bookId: string; title: string; chapters: number[] }) {
  const id = actionId as Id<"agentActions">;
  const action = useQuery(api.agentActions.get, { actionId: id });
  const decide = useMutation(api.agentActions.decide);
  const complete = useMutation(api.agentActions.complete);
  const appendActionUpdate = useMutation(api.agentChats.appendActionUpdate);
  const generateChapterImage = useAction(api.images.generateChapterImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = action?.status ?? "proposed";

  async function approve() {
    setBusy(true);
    let approved = false;
    try {
      await decide({ actionId: id, decision: "approved" });
      approved = true;
      const results = [];
      for (const chapter of chapters) results.push(await generateChapterImage({ bookId: bookId as Id<"books">, chapter }));
      await complete({ actionId: id, status: "executed", result: { chapters: results.length, actualCostUsd: results.reduce((sum, row) => sum + (row.actualCostUsd ?? 0), 0) } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      if (approved) {
        await complete({ actionId: id, status: "failed", result: { error: message } }).catch(() => {});
        await appendActionUpdate({ actionId: id, content: `I couldn’t generate the page-image batch for “${title}”: ${message}` }).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }

  return <Card className="max-w-md">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Page-image batch · needs approval</p>
    <p className="mt-2 text-sm font-semibold text-ink">{title}</p>
    <p className="mt-2 text-xs text-muted">Generate images for pages {chapters.join(", ")}. Each uses its chapter context.</p>
    {status === "proposed" ? <div className="mt-4 flex gap-2"><Button size="sm" disabled={busy} onClick={() => void approve()}>{busy ? "Generating…" : "Approve all"}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void decide({ actionId: id, decision: "rejected" })}>Reject</Button></div> : <div className="mt-4"><Badge variant={status === "executed" ? "success" : status === "rejected" ? "neutral" : "danger"}>{status === "executed" ? "Generated" : status}</Badge></div>}
    {error ? <p className="mt-2 text-xs font-semibold text-red-strong">{error}</p> : null}
  </Card>;
}

// Single registry — the same map both the chat cards and (future) dashboard
// grid look tool/component names up in, per docs/03-admin-agent.md.
export const AGENT_COMPONENTS: Record<string, ComponentType<any>> = {
  BookStatsCard,
  TopSellersTable,
  RevenueStatsCard,
  NavigateCard,
  WebResearchCard,
  TranslationReviewCard,
  ProposalCard,
  BookDraftCard,
  ImageGenerationProposalCard,
  ImageBatchProposalCard,
};
