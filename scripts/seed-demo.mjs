import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const convex = join(root, "node_modules", ".bin", "convex");
const covers = [
  "pregnancy-safety-basics",
  "newborn-home-readiness",
  "first-aid-quick-guide",
  "home-emergency-prep",
  "food-and-hygiene-routines",
  "workplace-safety-startup-kit",
  "safe-travels-a-toddler-s-car-safety-guide",
];

function run(name, args = {}) {
  const output = execFileSync(convex, ["run", name, JSON.stringify(args)], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
  return output ? JSON.parse(output) : undefined;
}

console.log(`Demo records: ${run("seed:seed")}`);

for (const slug of covers) {
  const uploadUrl = run("seed:createCoverUploadUrl", { slug });
  if (!uploadUrl) {
    console.log(`Cover exists: ${slug}`);
    continue;
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/webp" },
    body: await readFile(join(root, "docs", "demo-book-covers", `${slug}.webp`)),
  });
  if (!response.ok) throw new Error(`Cover upload failed for ${slug}: ${response.status}`);

  const { storageId } = await response.json();
  run("seed:attachCover", { slug, storageId });
  console.log(`Cover uploaded: ${slug}`);
}
