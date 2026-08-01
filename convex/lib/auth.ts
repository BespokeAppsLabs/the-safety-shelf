import {
  customQuery,
  customMutation,
  customCtx,
} from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";
import { query, mutation, internalMutation, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// Auth seam: Clerk isn't wired yet, but ctx.auth.getUserIdentity() and the
// `users.by_clerkId` lookup below are the exact shape the real Clerk+Convex
// integration produces (identity.subject = Clerk user id). convex-test's
// t.withIdentity({ subject }) simulates this, so this resolver is fully
// testable today and needs zero changes once Clerk is connected.

export async function resolveViewer(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) throw new ConvexError("No account for this identity");
  return user;
}

/** Query for a signed-in viewer. ctx gains { viewer }. */
export const viewerQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ viewer: await resolveViewer(ctx) })),
);

/** Mutation for a signed-in viewer. ctx gains { viewer }. */
export const viewerMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ viewer: await resolveViewer(ctx) })),
);

/**
 * Internal mutation for a signed-in viewer. Convex propagates the caller's
 * identity through ctx.runMutation, so an action can resolve the same viewer
 * an ordinary mutation would — used by payments.startCheckout, which must run
 * its guards inside a transaction before talking to Paystack.
 */
export const viewerInternalMutation = customMutation(
  internalMutation,
  customCtx(async (ctx) => ({ viewer: await resolveViewer(ctx) })),
);

/** Authorization guard: throws unless the viewer is the store owner. */
export function requireOwner(viewer: Doc<"users">): void {
  if (viewer.role !== "owner") {
    throw new ConvexError("Owner only");
  }
}
