"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { api } from "@/convex/_generated/api";
import { useBasePriceFormatter } from "@/components/store/Price";

// OpenRouter bills in USD credits, so this genuinely is dollars — it is not the
// store's currency and must not be converted. Store money goes through
// useBasePriceFormatter instead.
function credits(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function AdminOverviewScreen() {
  const { isAuthenticated } = useConvexAuth();
  const money = useBasePriceFormatter();
  const overview = useQuery(api.dashboard.overview, isAuthenticated ? {} : "skip");
  const getUsage = useAction(api.openrouterUsage.get);
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof getUsage>> | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    void getUsage({}).then(setUsage).catch((error: unknown) => setUsageError(error instanceof Error ? error.message : String(error)));
  }, [getUsage, isAuthenticated]);

  const stats = overview ? [
    { label: "Live guides", value: String(overview.liveBooks), detail: "Published books in the live catalog." },
    { label: "Revenue", value: money(overview.revenueCents) ?? "—", detail: overview.currency ? "Paid-order total." : "Set the store currency in Settings." },
    { label: "Library unlocks", value: String(overview.activeUnlocks), detail: "Active reader entitlements." },
    { label: "Pending approvals", value: String(overview.pendingApprovals), detail: "Agent proposals awaiting your decision." },
    // Always rendered, including at zero: a payment alert tile that only
    // appears when something is wrong is a tile nobody learns to look at.
    {
      label: "Payments to review",
      value: String(overview.paymentsNeedingAttention),
      detail: overview.paymentsNeedingAttention
        ? "Double charges or mismatched settlements. Refund in Paystack."
        : "No payments need a decision.",
    },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Dashboard</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">Store health at a glance.</h1>
        <p className="mt-3 text-base text-muted">Live store, workflow, and OpenRouter data.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">Draft and publish queue</h2>
              <p className="mt-1 text-sm text-muted">Current drafts and proposed actions.</p>
            </div>
            <Link href="/admin/agent" className="text-sm font-semibold text-primary">Open agent →</Link>
          </div>
          <div className="mt-6 space-y-4">
            {(overview?.queue ?? []).map((item) => (
              <div key={item.id} className="rounded-3xl bg-background px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">{item.body}</p>
                  </div>
                  <Badge variant={item.variant}>{item.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-ink">OpenRouter usage</h2>
            {/* Which key these figures describe. A limit set on a different key
                is the likeliest reason this panel looks wrong. */}
            {usage?.label ? (
              <p className="font-mono text-xs text-muted">{usage.label}{usage.isFreeTier ? " · free tier" : ""}</p>
            ) : null}
          </div>
          <div className="mt-6 space-y-4">
            {usage ? <>
              {/* Limit / spent / left, the three figures at a glance. All three
                  come from OpenRouter's /key endpoint and describe THIS key, not
                  the account: account-wide credits need a management key, which
                  an inference key is refused for (403). */}
              <dl className="grid grid-cols-3 gap-3">
                <div className="rounded-3xl bg-background px-4 py-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Limit</dt>
                  <dd className="mt-1 text-lg font-semibold text-ink">
                    {usage.limit === null ? "Not set" : credits(usage.limit)}
                  </dd>
                </div>
                <div className="rounded-3xl bg-background px-4 py-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Spent</dt>
                  <dd className="mt-1 text-lg font-semibold text-ink">{credits(usage.usage)}</dd>
                </div>
                <div className="rounded-3xl bg-background px-4 py-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Left</dt>
                  <dd className="mt-1 text-lg font-semibold text-ink">
                    {usage.limitRemaining === null ? "—" : credits(usage.limitRemaining)}
                  </dd>
                </div>
              </dl>

              {usage.limit === null ? (
                // "Unlimited" read as reassurance; it actually means this key has
                // no cap, so there is no ceiling to spend against and nothing to
                // warn on before the bill arrives.
                <p className="text-sm text-muted">
                  {usage.isFreeTier
                    ? "This is a free-tier key, which has no credit cap — there is no limit or remaining balance to report."
                    : "This key has no spending cap, so there is no remaining balance to track. Set one on the key at openrouter.ai → Keys and both figures fill in here."}
                </p>
              ) : (
                <div className="rounded-3xl bg-background px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {Math.round((usage.usage / usage.limit) * 100)}% of the cap used
                      </p>
                      {usage.limitReset ? (
                        <p className="mt-1 text-sm text-muted">Resets {usage.limitReset}.</p>
                      ) : null}
                    </div>
                    <Badge variant={usage.limitRemaining !== null && usage.limitRemaining <= usage.limit * 0.1 ? "danger" : "success"}>
                      {credits(usage.limitRemaining ?? 0)} left
                    </Badge>
                  </div>
                </div>
              )}

              <div className="rounded-3xl bg-background px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">Recent spend</p>
                    <p className="mt-1 text-sm text-muted">Today {credits(usage.usageDaily)} · This week {credits(usage.usageWeekly)}</p>
                  </div>
                  <Badge variant="info">{credits(usage.usageMonthly)} this month</Badge>
                </div>
              </div>
            </> : <div className="rounded-3xl bg-background px-4 py-4"><p className="text-sm text-muted">{usageError ?? "Loading OpenRouter usage…"}</p></div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
