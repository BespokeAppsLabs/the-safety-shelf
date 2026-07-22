// Platform catalog for the Social panel. `v1` marks the platforms scope-v1
// promises now (IG/FB/X); TikTok stays listed-but-off until Postiz + audit.
// See docs/04-social-postiz.md.
export const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram", v1: true, guidance: "Warm, visual caption. 3-6 relevant hashtags. Emoji ok. ~150 words max." },
  { value: "facebook", label: "Facebook", v1: true, guidance: "Conversational, slightly longer. A clear call to action to the store. Few or no hashtags." },
  { value: "x", label: "X", v1: true, guidance: "Punchy, under 280 characters total including the link. 1-2 hashtags." },
  { value: "linkedin", label: "LinkedIn", v1: false, guidance: "Professional, value-led. Frame the book's safety benefit. No emoji spam." },
  { value: "tiktok", label: "TikTok", v1: false, guidance: "Short hook caption for a video. Trend-aware. Needs a video asset (not built in v1)." },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["value"];

export const SOCIAL_PLATFORM_VALUES = SOCIAL_PLATFORMS.map((p) => p.value) as SocialPlatform[];

export function socialPlatform(value: string) {
  return SOCIAL_PLATFORMS.find((p) => p.value === value);
}

export function socialPlatformLabel(value: string) {
  return socialPlatform(value)?.label ?? value;
}

export const SOCIAL_POST_STATUS = {
  draft: { label: "Draft", variant: "warning" as const },
  scheduled: { label: "Scheduled", variant: "info" as const },
  published: { label: "Published", variant: "success" as const },
  failed: { label: "Failed", variant: "danger" as const },
};
