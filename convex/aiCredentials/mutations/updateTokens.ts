import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../_generated/server";

/** Persist rotated OAuth tokens after a refresh. */
export const updateTokens = internalMutation({
  args: {
    credentialId: v.id("aiCredentials"),
    encryptedKey: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { credentialId, encryptedKey, encryptedRefreshToken, accessTokenExpiresAt }) => {
    const existing = await ctx.db.get(credentialId);
    if (!existing) throw new ConvexError("Credential not found");
    await ctx.db.patch(credentialId, {
      encryptedKey,
      ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
      ...(accessTokenExpiresAt ? { accessTokenExpiresAt } : {}),
      validatedAt: Date.now(),
    });
  },
});
