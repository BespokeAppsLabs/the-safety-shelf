import {
  customQuery,
  customMutation,
  customCtx,
} from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";
import { query, mutation, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// Auth seam: Clerk isn't wired yet, but ctx.auth.getUserIdentity() and the
// `users.by_clerkId` lookup below are the exact shape the real Clerk+Convex
// integration produces (identity.subject = Clerk user id). convex-test's
// t.withIdentity({ subject }) simulates this, so this resolver is fully
// testable today and needs zero changes once Clerk is connected.

async function resolveViewer(ctx: QueryCtx): Promise<Doc<"users">> {
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

/** Authorization guard: throws unless the viewer is the store owner. */
export function requireOwner(viewer: Doc<"users">): void {
  if (viewer.role !== "owner") {
    throw new ConvexError("Owner only");
  }
}
