// ElevenLabs TTS model catalog. maxChars is the documented per-request
// character limit (July 2026): https://elevenlabs.io/docs/overview/models
// We generate one request per chapter, so a chapter must fit within the
// selected model's limit.
export const ELEVENLABS_MODELS = {
  eleven_multilingual_v2: { label: "Multilingual v2 — best quality", maxChars: 10_000 },
  eleven_flash_v2_5: { label: "Flash v2.5 — fast & long", maxChars: 40_000 },
  eleven_v3: { label: "v3 — most expressive", maxChars: 5_000 },
} as const;

export type ElevenLabsModel = keyof typeof ELEVENLABS_MODELS;

export const DEFAULT_ELEVENLABS_MODEL: ElevenLabsModel = "eleven_multilingual_v2";
// Rachel — an ElevenLabs default voice. Override per-request or via env.
export const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export function isElevenLabsModel(model: string): model is ElevenLabsModel {
  return model in ELEVENLABS_MODELS;
}

export function chapterNarration(heading: string, body: string): string {
  return [heading.trim(), body.trim()].filter(Boolean).join(".\n\n");
}

export type AudioSegment = { chapter: number; text: string };

// One narration segment per non-empty chapter, each checked against the model's
// per-request character limit. Returns the segments, or the first over-limit
// chapter as an error the caller surfaces to the owner.
export function planNarration(
  chapters: { heading: string; body: string }[],
  model: ElevenLabsModel,
): { ok: true; segments: AudioSegment[] } | { ok: false; error: string } {
  const limit = ELEVENLABS_MODELS[model].maxChars;
  const segments: AudioSegment[] = [];
  chapters.forEach((chapter, index) => {
    const text = chapterNarration(chapter.heading, chapter.body);
    if (text) segments.push({ chapter: index + 1, text });
  });

  if (!segments.length) return { ok: false, error: "This book has no text to narrate." };

  const over = segments.find((segment) => segment.text.length > limit);
  if (over) {
    return {
      ok: false,
      error: `Chapter ${over.chapter} is ${over.text.length} characters, over the ${limit.toLocaleString()} limit for ${model}. Split the chapter or choose a higher-limit model.`,
    };
  }
  return { ok: true, segments };
}
