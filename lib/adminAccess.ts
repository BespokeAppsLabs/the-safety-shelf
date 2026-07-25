export const ADMIN_REDIRECT_DELAY_MS = 5_000;

export function isAdminOwner(role: string | null | undefined) {
  return role === "owner";
}
