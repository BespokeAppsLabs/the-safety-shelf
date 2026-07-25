"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ADMIN_REDIRECT_DELAY_MS } from "@/lib/adminAccess";

export function AdminAccessDenied() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(ADMIN_REDIRECT_DELAY_MS / 1_000);

  useEffect(() => {
    const countdown = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1_000);
    const redirect = window.setTimeout(() => router.replace("/"), ADMIN_REDIRECT_DELAY_MS);
    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(redirect);
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-4" aria-live="assertive">
      <Card className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-strong">Access denied</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Owner access required</h1>
        <p className="mt-3 text-sm text-muted">You do not have permission to access the admin workspace. Redirecting to the home page in {seconds} seconds.</p>
        <Link href="/" className="mt-5 inline-block text-sm font-semibold text-primary">Return now →</Link>
      </Card>
    </main>
  );
}
