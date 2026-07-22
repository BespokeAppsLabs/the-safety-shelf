"use node";
import { ConvexError } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { higgsfieldAccessToken } from "./lib/higgsfieldAuth";
import { HiggsfieldSession } from "./lib/higgsfield";

async function higgsfieldToken(ctx: ActionCtx): Promise<string> {
  const viewer = await ctx.runQuery(api.users.getViewer, {});
  if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");
  const credential = await ctx.runQuery(internal.aiCredentials.queries.getForOwner.getForOwner, {
    ownerId: viewer._id,
    purpose: "image",
  });
  if (!credential || credential.provider !== "higgsfield") {
    throw new ConvexError("Login to Higgsfield MCP in Settings first.");
  }
  return higgsfieldAccessToken(ctx, credential);
}

/** Diagnostic: what the live MCP server actually exposes. */
export const listTools = action({
  args: {},
  handler: async (ctx): Promise<{ tools: Array<{ name: string; description?: string; inputSchemaJson: string }> }> => {
    const session = await HiggsfieldSession.open(await higgsfieldToken(ctx));
    const tools = (await session.listTools()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchemaJson: JSON.stringify(tool.inputSchema ?? {}, null, 2),
    }));
    return { tools };
  },
});
