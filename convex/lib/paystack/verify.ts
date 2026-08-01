// ============================================
// PAYSTACK WEBHOOK SIGNATURE VERIFICATION
// Paystack signs every webhook body with HMAC-SHA512 keyed by the SECRET key.
// We recompute the digest over the RAW request body and constant-time compare
// it to the `x-paystack-signature` header.
//
// Pure module (no Convex imports) — unit-testable in isolation.
// Uses Web Crypto (`crypto.subtle`), available in the Convex action runtime.
// ============================================

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time hex string comparison (avoids signature timing leaks). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** HMAC-SHA512 of `body` keyed by `secret`, hex-encoded. */
export async function hmacSha512Hex(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return toHex(sig);
}

/**
 * Verify a Paystack webhook signature against the deployment secret key.
 * Returns false on any missing input rather than throwing — the caller
 * answers 401 on false.
 */
export async function verifySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret = process.env.PAYSTACK_SECRET_KEY,
): Promise<boolean> {
  if (!secret || !signatureHeader) return false;
  const computed = await hmacSha512Hex(rawBody, secret);
  return timingSafeEqual(computed, signatureHeader.toLowerCase());
}
