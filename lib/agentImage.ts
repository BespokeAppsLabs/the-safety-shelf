export function agentImageUrl(result: unknown) {
  if (!result || typeof result !== "object") return null;
  const url = (result as { url?: unknown }).url;
  return typeof url === "string" && url ? url : null;
}
