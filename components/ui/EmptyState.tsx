import Link from "next/link";
import { Card } from "@/components/ui/Card";

export function EmptyState({
  actionHref,
  actionLabel,
  body,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  body: string;
  title: string;
}) {
  return (
    <Card className="text-center">
      <p className="text-4xl">🧺</p>
      <h2 className="mt-4 text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <Link href={actionHref} className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong">
        {actionLabel}
      </Link>
    </Card>
  );
}
