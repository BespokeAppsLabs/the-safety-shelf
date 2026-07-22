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
import { formatPrice } from "@/lib/money";

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
          <dd className="mt-1 text-sm font-semibold text-ink">{formatPrice(props.priceCents ?? 0)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Units</dt>
          <dd className="mt-1 text-sm font-semibold text-ink">{props.units ?? 0}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Revenue</dt>
          <dd className="mt-1 text-sm font-semibold text-ink">{formatPrice(props.revenueCents ?? 0)}</dd>
        </div>
      </dl>
      {props.slug ? (
        <Link href={`/book/${props.slug}`} className="mt-4 block text-sm font-semibold text-primary">
          View storefront page →
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
          <Link key={row.slug} href={`/book/${row.slug}`} className="flex items-center gap-3">
            <CoverThumb coverUrl={row.coverUrl} gradientFrom={row.gradientFrom} gradientTo={row.gradientTo} title={row.title} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{row.title}</p>
              <p className="text-xs text-muted">{row.units} units · {formatPrice(row.revenueCents)}</p>
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
          <dd className="mt-1 text-lg font-semibold text-ink">{formatPrice(totalRevenueCents)}</dd>
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
        className="mt-3 inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong"
      >
        {label} →
      </Link>
    </Card>
  );
}

// Propose-then-confirm controls shared by every write-tool card. Subscribes to
// the proposal so Approve/Reject in one card reflects immediately; Approve runs
// the write server-side (agentActions.approveAndExecute), Reject just records
// the verdict. Buttons vanish once the proposal leaves "proposed".
export function ApprovalControls({ actionId }: { actionId: string }) {
  const id = actionId as Id<"agentActions">;
  const action = useQuery(api.agentActions.get, { actionId: id });
  const approve = useMutation(api.agentActions.approveAndExecute);
  const reject = useMutation(api.agentActions.decide);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = action?.status ?? "proposed";
  if (status !== "proposed") {
    const variant = status === "executed" ? "success" : status === "rejected" ? "neutral" : "danger";
    const label = status === "executed" ? "Approved & applied" : status === "rejected" ? "Rejected" : "Failed";
    return (
      <div className="mt-4">
        <Badge variant={variant}>{label}</Badge>
      </div>
    );
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void run(() => approve({ actionId: id }))}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void run(() => reject({ actionId: id, decision: "rejected" }))}
        >
          Reject
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-red-strong">{error}</p> : null}
    </div>
  );
}

// Generic proposal (e.g. publishBook) — a title, a one-line summary, controls.
export function ProposalCard({ actionId, title, summary }: { actionId: string; title: string; summary: string }) {
  return (
    <Card className="max-w-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Needs approval</p>
      <p className="mt-2 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{summary}</p>
      <ApprovalControls actionId={actionId} />
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
        <Badge variant="success">{formatPrice(priceCents)}</Badge>
      </div>
      <ApprovalControls actionId={actionId} />
    </Card>
  );
}


export function ImageGenerationProposalCard({
  actionId,
  target,
  bookId,
  chapter,
  title,
  modelId,
  prompt,
  estimate,
}: {
  actionId: string;
  target: "cover" | "page";
  bookId: string;
  chapter?: number;
  title: string;
  modelId: string;
  prompt: string;
  estimate: string;
}) {
  const id = actionId as Id<"agentActions">;
  const action = useQuery(api.agentActions.get, { actionId: id });
  const decide = useMutation(api.agentActions.decide);
  const complete = useMutation(api.agentActions.complete);
  const generateCover = useAction(api.images.generateCover);
  const generateChapterImage = useAction(api.images.generateChapterImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const status = action?.status ?? "proposed";
  // Re-render the image after a page reload too: the executed action stores the
  // result URL, so a card that finished in an earlier session still shows it.
  const resultUrl = imageUrl ?? (action?.result as { url?: string } | undefined)?.url ?? null;

  async function approve() {
    setBusy(true);
    setError(null);
    let approved = false;
    try {
      await decide({ actionId: id, decision: "approved" });
      approved = true;
      const result = target === "cover"
        ? await generateCover({ bookId: bookId as Id<"books">, modelId, prompt })
        : await generateChapterImage({ bookId: bookId as Id<"books">, chapter: chapter ?? 1, modelId, prompt });
      setImageUrl(result.url ?? null);
      await complete({ actionId: id, status: "executed", result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      if (approved) await complete({ actionId: id, status: "failed", result: { error: message } }).catch(() => {});
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
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{modelId}</Badge>
        <Badge variant="warning">{estimate} est.</Badge>
      </div>
      <p className="mt-3 line-clamp-4 text-xs text-muted">{prompt}</p>
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

// Single registry — the same map both the chat cards and (future) dashboard
// grid look tool/component names up in, per docs/03-admin-agent.md.
export const AGENT_COMPONENTS: Record<string, ComponentType<any>> = {
  BookStatsCard,
  TopSellersTable,
  RevenueStatsCard,
  NavigateCard,
  ProposalCard,
  BookDraftCard,
  ImageGenerationProposalCard,
};
