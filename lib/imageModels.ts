export const IMAGE_PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "stability", label: "Stability AI" },
  { value: "higgsfield", label: "Higgsfield MCP" },
] as const;

export type ImageProvider = (typeof IMAGE_PROVIDERS)[number]["value"];

// `higgsfieldModel` is the id from the live Higgsfield model catalog
// (models_explore action:"list"); `higgsfieldParams` are that model's own
// optional params, verified per-model via models_explore action:"get".
// The public `id` stays stable because it is persisted in agentActions props.
export const IMAGE_MODELS = [
  { id: "gpt-image-2", provider: "openai", label: "GPT Image 2", estimateCents: 10, estimateCredits: undefined, size: "1024x1024" },
  { id: "gpt-image-1.5", provider: "openai", label: "GPT Image 1.5", estimateCents: 6, estimateCredits: undefined, size: "1024x1024" },
  { id: "gpt-image-1", provider: "openai", label: "GPT Image 1", estimateCents: 8, estimateCredits: undefined, size: "1024x1024" },
  { id: "stable-image-core", provider: "stability", label: "Stable Image Core", estimateCents: 4, estimateCredits: undefined, size: "1:1" },
  { id: "higgsfield-flux-2", provider: "higgsfield", label: "Flux 2.0", estimateCents: 0, estimateCredits: 1, size: "1:1", higgsfieldModel: "flux_2", higgsfieldParams: { resolution: "1k", variant: "pro" } },
  { id: "higgsfield-auto", provider: "higgsfield", label: "Higgsfield Auto", estimateCents: 0, estimateCredits: 1, size: "1:1", higgsfieldModel: "image_auto", higgsfieldParams: {} },
  { id: "higgsfield-gpt-image-2", provider: "higgsfield", label: "GPT Image 2 via Higgsfield", estimateCents: 0, estimateCredits: 1, size: "1:1", higgsfieldModel: "gpt_image_2", higgsfieldParams: { resolution: "1k" } },
  { id: "higgsfield-seedream-5", provider: "higgsfield", label: "Seedream 5", estimateCents: 0, estimateCredits: 1, size: "1:1", higgsfieldModel: "seedream_v5_pro", higgsfieldParams: { resolution: "1k" } },
  { id: "higgsfield-nano-banana-pro", provider: "higgsfield", label: "Nano Banana Pro", estimateCents: 0, estimateCredits: 1, size: "1:1", higgsfieldModel: "nano_banana_pro", higgsfieldParams: { resolution: "1k" } },
  { id: "higgsfield-soul-2", provider: "higgsfield", label: "Soul 2.0 / consistent character", estimateCents: 0, estimateCredits: 1, size: "1:1", higgsfieldModel: "soul_2", higgsfieldParams: {} },
] as const;

export const HIGGSFIELD_VIDEO_MODELS = [
  "Sora 2",
  "Veo 3.1",
  "Kling 3.0",
  "WAN 2.6",
  "Seedance 2.0",
  "Grok Imagine 1.5",
  "Gemini Omni Flash",
  "Cinema Studio 3.0",
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"];

export function imageModelsFor(provider?: string) {
  return IMAGE_MODELS.filter((model) => !provider || model.provider === provider);
}

export function imageModel(id: string) {
  return IMAGE_MODELS.find((model) => model.id === id) ?? IMAGE_MODELS[0];
}

export function formatImageEstimate(cents: number, credits?: number) {
  if (credits !== undefined) return `~${credits} credit${credits === 1 ? "" : "s"}`;
  return `~$${(cents / 100).toFixed(2)}`;
}
