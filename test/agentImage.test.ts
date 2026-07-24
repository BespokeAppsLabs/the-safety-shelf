import { expect, test } from "vitest";
import { agentImageUrl } from "../lib/agentImage";

test("shows the persisted generated image URL in its chat card", () => {
  expect(agentImageUrl({ storageId: "storage_1", url: "https://storage.example/cover.webp", actualCostUsd: 0.01 }))
    .toBe("https://storage.example/cover.webp");
  expect(agentImageUrl({ storageId: "storage_1" })).toBeNull();
});
