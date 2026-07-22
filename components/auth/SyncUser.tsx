"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Syncs the signed-in Clerk identity into Convex's `users` table.
// upsertFromClerk is idempotent, so re-running this on every sign-in is safe.
export function SyncUser() {
  const { isSignedIn, user } = useUser();
  const upsertFromClerk = useMutation(api.users.upsertFromClerk);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) return;

    void upsertFromClerk({
      email,
      name: user.fullName ?? email,
    });
  }, [isSignedIn, user, upsertFromClerk]);

  return null;
}
