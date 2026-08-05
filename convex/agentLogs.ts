import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Internal-only — written by agent.ts and translate.ts (both "use node"
// actions) after every LLM call. Distinct from agentActions: this is call
// observability (model, tokens, latency, cost), not the propose-then-confirm
// approval trail.
//
// `model` must be the model the PROVIDER reports serving, not the one the code
// asked for. Fallback routing can substitute a model, so recording only the
// requested constant would hide the actual behaviour and bill.
export const record = internalMutation({
  args: {
    role: v.union(
      v.literal("orchestrator"), v.literal("writer"), v.literal("reviewer"),
      v.literal("translator"), v.literal("social"), v.literal("analyst"),
    ),
    model: v.string(),
    tool: v.optional(v.string()),
    subject: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    status: v.union(v.literal("ok"), v.literal("error")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => ctx.db.insert("agentLogs", args),
});
