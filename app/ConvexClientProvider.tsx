"use client";

import { ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { SyncUser } from "@/components/auth/SyncUser";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  // afterSignOutUrl: signing out from a protected page (any /admin route) would
  // otherwise leave the user standing on it and get bounced to sign-in by
  // auth.protect() — which reads as a failed logout. In Clerk 7 this is a
  // provider option, not a UserButton prop.
  return (
    <ClerkProvider afterSignOutUrl="/">
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <SyncUser />
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
