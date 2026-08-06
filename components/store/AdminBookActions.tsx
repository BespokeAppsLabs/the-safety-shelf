"use client";

import { useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Button } from "@/components/ui/Button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { isAdminOwner } from "@/lib/adminAccess";
import { coverFileName } from "@/lib/coverFile";

// Owner-only shortcuts on the public product page, for pulling a cover and a
// share link without going through the admin catalogue.
//
// Not translated, for the same reason ADMIN_NAV is not: this is owner surface,
// and the owner is one operator.
//
// Both actions operate on data the page already exposes — the cover is the
// <img src> beside these buttons, and the URL is the address bar — so the role
// check hides clutter rather than guarding a secret. Nothing here needs a
// server-side gate because there is nothing here a visitor could not already
// take. Anything that reveals non-public data must not be added to this
// component without moving the check server-side.
export function AdminBookActions({ book }: { book: Doc<"books"> & { coverUrl?: string | null } }) {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.getViewer, isAuthenticated ? {} : "skip");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isAdminOwner(viewer?.role)) return null;

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        disabled={!book.coverUrl || busy}
        onClick={async () => {
          if (!book.coverUrl) return;
          setBusy(true);
          try {
            // Fetched to a blob rather than linked with `download`: that
            // attribute is ignored cross-origin, and Convex serves the image
            // inline, so a plain link opens a tab instead of saving a file.
            const response = await fetch(book.coverUrl);
            if (!response.ok) throw new Error(String(response.status));
            const objectUrl = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = coverFileName(book.coverUrl, book.slug);
            link.click();
            URL.revokeObjectURL(objectUrl);
          } catch {
            // CORS or a network failure. Opening the image still lets the
            // owner save it by hand, which beats a button that does nothing.
            window.open(book.coverUrl, "_blank", "noopener");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Downloading…" : "Download cover"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied" : "Copy URL"}
      </Button>
    </div>
  );
}
