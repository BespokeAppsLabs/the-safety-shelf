import { expect, test } from "vitest";
import { ADMIN_REDIRECT_DELAY_MS, isAdminOwner } from "../lib/adminAccess";

test("allows only the owner role into admin", () => {
  expect(isAdminOwner("owner")).toBe(true);
  expect(isAdminOwner("customer")).toBe(false);
  expect(isAdminOwner(null)).toBe(false);
  expect(ADMIN_REDIRECT_DELAY_MS).toBe(5_000);
});
