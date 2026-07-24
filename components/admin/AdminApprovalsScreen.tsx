"use client";

import { useState } from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ApprovalControls } from "@/components/admin/AgentCards";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatPrice } from "@/lib/money";

const DECISION_VARIANT = {
  executed: "success",
  rejected: "neutral",
  failed: "danger",
  approved: "info",
} as const;

// Human-readable line for a proposed agent write, from the tool + its args.
function summarize(action: Doc<"agentActions">): { label: string; detail: string } {
  const args = (action.args ?? {}) as Record<string, unknown>;
  if (action.tool === "publishBook") {
    return { label: `Publish “${String(args.title ?? "book")}”`, detail: "Make an existing draft live and purchasable." };
  }
  if (action.tool === "writeBook") {
    const chapters = Array.isArray(args.chapters) ? args.chapters.length : 0;
    const price = typeof args.priceCents === "number" ? ` · ${formatPrice(args.priceCents)}` : "";
    return { label: `New draft: “${String(args.title ?? "untitled")}”`, detail: `${chapters} chapter${chapters === 1 ? "" : "s"}${price}` };
  }
  return { label: action.tool, detail: JSON.stringify(args).slice(0, 120) };
}

function PublishButton({ bookId }: { bookId: Id<"books"> }) {
  const setStatus = useMutation(api.books.setStatus);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await setStatus({ bookId, status: "live" });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Publishing…" : "Publish"}
    </Button>
  );
}

export function AdminApprovalsScreen() {
  const { isAuthenticated } = useConvexAuth();
  const actions = useQuery(api.agentActions.list, isAuthenticated ? {} : "skip");
  const books = useQuery(api.books.listAll, isAuthenticated ? {} : "skip");
  const categories = useQuery(api.categories.list, isAuthenticated ? {} : "skip");

  const categoryTitle = new Map((categories ?? []).map((category) => [category._id, category.title]));

  const pending = (actions ?? []).filter((action) => action.status === "proposed");
  const decided = (actions ?? [])
    .filter((action) => action.status !== "proposed")
    .sort((a, b) => (b.decidedAt ?? b.proposedAt) - (a.decidedAt ?? a.proposedAt));
  const drafts = (books ?? []).filter((book) => book.status === "draft");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Approvals</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">Review what the agent proposed.</h1>
        <p className="mt-3 text-base text-muted">
          Nothing the agent writes or publishes takes effect until you approve it here. Draft books wait below until you
          publish them.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-ink">Pending approvals</h2>
          <Badge variant={pending.length ? "warning" : "neutral"}>{pending.length}</Badge>
        </div>
        {actions === undefined ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : pending.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No proposals waiting. When the agent proposes a write, it shows up here.</p>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {pending.map((action) => {
              const { label, detail } = summarize(action);
              return (
                <Card key={action._id}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{action.tool}</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{label}</p>
                  <p className="mt-1 text-sm text-muted">{detail}</p>
                  <ApprovalControls actionId={action._id} />
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-ink">Draft books</h2>
          <Badge variant={drafts.length ? "info" : "neutral"}>{drafts.length}</Badge>
        </div>
        {books === undefined ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : drafts.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No drafts. Approved book drafts and anything not yet live will appear here.</p>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {drafts.map((book) => (
              <Card key={book._id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-ink">{book.title}</p>
                    <p className="mt-1 text-sm text-muted">{categoryTitle.get(book.categoryId) ?? "—"}</p>
                  </div>
                  <Badge>{formatPrice(book.priceCents)}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted">{book.blurb}</p>
                <div className="mt-4 flex items-center gap-3">
                  <PublishButton bookId={book._id} />
                  <Link href={`/admin/books/preview/${book._id}`} className="text-sm font-semibold text-primary">
                    Preview →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-ink">Recent decisions</h2>
          <Card>
            <div className="space-y-2">
              {decided.slice(0, 12).map((action) => {
                const { label } = summarize(action);
                return (
                  <div key={action._id} className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3">
                    <p className="min-w-0 truncate text-sm text-ink">{label}</p>
                    <Badge variant={DECISION_VARIANT[action.status as keyof typeof DECISION_VARIANT] ?? "neutral"}>
                      {action.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
