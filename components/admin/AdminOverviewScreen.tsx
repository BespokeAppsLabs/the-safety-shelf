import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { ADMIN_QUEUE, ADMIN_STATS, SOCIAL_STATUS } from "@/lib/admin";

export function AdminOverviewScreen() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Dashboard</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">Store health at a glance.</h1>
        <p className="mt-3 text-base text-muted">Shared card system now. Live Convex metrics and agent calls later.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ADMIN_STATS.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">Draft and publish queue</h2>
              <p className="mt-1 text-sm text-muted">Mock state for the owner workflow.</p>
            </div>
            <Link href="/admin/agent" className="text-sm font-semibold text-primary">Open agent →</Link>
          </div>
          <div className="mt-6 space-y-4">
            {ADMIN_QUEUE.map((item) => (
              <div key={item.title} className="rounded-3xl bg-background px-4 py-4">
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
          <h2 className="text-xl font-semibold text-ink">Channel readiness</h2>
          <div className="mt-6 space-y-4">
            {SOCIAL_STATUS.map((account) => (
              <div key={account.platform} className="rounded-3xl bg-background px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{account.platform}</p>
                    <p className="mt-1 text-sm text-muted">{account.body}</p>
                  </div>
                  <Badge variant={account.variant}>{account.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
