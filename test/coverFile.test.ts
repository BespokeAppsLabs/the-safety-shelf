import { expect, test } from "vitest";
import { coverFileName } from "../lib/coverFile";

test("names the cover download from the slug and the URL's extension", () => {
  expect(coverFileName("https://x.convex.cloud/a.png", "first-aid")).toBe("first-aid-cover.png");
  expect(coverFileName("https://x.convex.cloud/a.JPEG", "first-aid")).toBe("first-aid-cover.jpeg");
  // Query strings and fragments must not swallow the extension.
  expect(coverFileName("https://x.convex.cloud/a.webp?token=1", "first-aid")).toBe("first-aid-cover.webp");
  // Convex storage URLs are extensionless, which is the common case here.
  expect(coverFileName("https://x.convex.cloud/api/storage/9f2c-abc", "first-aid")).toBe("first-aid-cover.jpg");
  // A dot in the path that is not an image extension is not an extension.
  expect(coverFileName("https://x.convex.cloud/v1.2/cover", "first-aid")).toBe("first-aid-cover.jpg");
});
