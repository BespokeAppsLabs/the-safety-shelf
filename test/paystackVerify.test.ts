import { expect, test } from "vitest";
import { hmacSha512Hex, verifySignature } from "../convex/lib/paystack/verify";

const SECRET = "sk_test_pretend";
const BODY = JSON.stringify({ event: "charge.success", data: { reference: "TSS-abc" } });

test("accepts a signature computed over the raw body with the secret key", async () => {
  const signature = await hmacSha512Hex(BODY, SECRET);
  expect(await verifySignature(BODY, signature, SECRET)).toBe(true);
});

test("accepts an upper-case signature header", async () => {
  const signature = await hmacSha512Hex(BODY, SECRET);
  expect(await verifySignature(BODY, signature.toUpperCase(), SECRET)).toBe(true);
});

test("rejects a body that was tampered with after signing", async () => {
  const signature = await hmacSha512Hex(BODY, SECRET);
  const tampered = JSON.stringify({ event: "charge.success", data: { reference: "TSS-other" } });
  expect(await verifySignature(tampered, signature, SECRET)).toBe(false);
});

test("rejects a signature made with a different secret", async () => {
  const signature = await hmacSha512Hex(BODY, "sk_test_attacker");
  expect(await verifySignature(BODY, signature, SECRET)).toBe(false);
});

test("rejects a missing signature header rather than throwing", async () => {
  expect(await verifySignature(BODY, null, SECRET)).toBe(false);
  expect(await verifySignature(BODY, "", SECRET)).toBe(false);
});

test("rejects when no secret is configured — never fails open", async () => {
  const signature = await hmacSha512Hex(BODY, SECRET);
  expect(await verifySignature(BODY, signature, undefined)).toBe(false);
});
