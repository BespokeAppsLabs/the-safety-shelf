import { expect, test } from "vitest";
import { validateRoute } from "../agent";

const slugs = ["first-aid-quick-guide", "pregnancy-safety"];

test("accepts known static admin routes", () => {
  expect(validateRoute("/admin", slugs)).toBeNull();
  expect(validateRoute("/admin/books", slugs)).toBeNull();
});

test("normalises trailing slashes and query strings", () => {
  expect(validateRoute("/admin/settings/", slugs)).toBeNull();
  expect(validateRoute("/store?ref=x", slugs)).toBeNull();
});

test("accepts book/read paths only for live slugs", () => {
  expect(validateRoute("/book/first-aid-quick-guide", slugs)).toBeNull();
  expect(validateRoute("/read/pregnancy-safety", slugs)).toBeNull();
  expect(validateRoute("/book/does-not-exist", slugs)).toMatch(/No live book/);
});

test("rejects invented paths with a correction message", () => {
  expect(validateRoute("/admin/overview", slugs)).toMatch(/not a real page/);
  expect(validateRoute("/dashboard", slugs)).toMatch(/Valid paths/);
});
