"use node";
import { ConvexError } from "convex/values";
import { action, type ActionCtx } from "../../_generated/server";
import { api, internal } from "../../_generated/api";

type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  preview_url?: string | null;
  labels?: Record<string, string> | null;
};

// A usable one-liner even when ElevenLabs leaves `description` null: fall back
// to the labels (accent · gender · age · use case).
function describe(voice: ElevenLabsVoice): string | undefined {
  if (voice.description?.trim()) return voice.description.trim();
  const labels = Object.values(voice.labels ?? {}).filter(Boolean);
  return labels.length ? labels.join(" · ") : undefined;
}

// Seed the voices table from ElevenLabs. Owner-triggered; reads the same
// ELEVEN_LABS_API_KEY Convex env var the generator uses.
export const sync = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<{ count: number }> => {
    const viewer = await ctx.runQuery(api.users.getViewer, {});
    if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");

    const apiKey = process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) throw new ConvexError("ELEVEN_LABS_API_KEY is not set on this deployment.");

    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });
    if (!response.ok) {
      throw new ConvexError(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }

    const data = (await response.json()) as { voices: ElevenLabsVoice[] };
    const voices = data.voices.map((voice) => ({
      voiceId: voice.voice_id,
      name: voice.name,
      description: describe(voice),
      category: voice.category ?? undefined,
      previewUrl: voice.preview_url ?? undefined,
    }));

    await ctx.runMutation(internal.voices.replaceAll, { voices });
    return { count: voices.length };
  },
});
