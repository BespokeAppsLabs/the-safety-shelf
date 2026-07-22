import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Internal-only — written by agent.ts (a "use node" action) after every LLM
// call. Distinct from agentActions: this is call observability (model,
// tokens, latency, cost), not the propose-then-confirm approval trail.
export const record = internalMutation({
  args: {
    role: v.union(
      v.literal("orchestrator"), v.literal("writer"), v.literal("reviewer"),
      v.literal("translator"), v.literal("social"), v.literal("analyst"),
    ),
    model: v.string(),
    tool: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    status: v.union(v.literal("ok"), v.literal("error")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => ctx.db.insert("agentLogs", args),
});
