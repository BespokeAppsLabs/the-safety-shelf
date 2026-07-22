import type { Doc } from "../_generated/dataModel";

export type Provider = Doc<"aiCredentials">["provider"];
export type CredentialPurpose = "text" | "image";

export const TEXT_PROVIDERS = ["openai", "deepseek", "kimi", "glm", "ollama"] as const;
export const IMAGE_PROVIDERS = ["openai", "stability", "higgsfield"] as const;

export const PROVIDER_DEFAULTS: Record<Provider, { baseURL?: string; model: string }> = {
  openai: { model: "gpt-4o-mini" },
  deepseek: { baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  kimi: { baseURL: "https://api.moonshot.ai/v1", model: "moonshot-v1-8k" },
  glm: { baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  ollama: { baseURL: "http://localhost:11434/v1", model: "llama3.1" },
  stability: { model: "stable-image-core" },
  higgsfield: { baseURL: "https://mcp.higgsfield.ai/mcp", model: "higgsfield-auto" },
};

export function isTextProvider(provider: Provider) {
  return (TEXT_PROVIDERS as readonly string[]).includes(provider);
}

export function isImageProvider(provider: Provider) {
  return (IMAGE_PROVIDERS as readonly string[]).includes(provider);
}
