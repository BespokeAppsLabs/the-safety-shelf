import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../lib/dictionaries/en.json";
import { LANGUAGES } from "../lib/languages";
import { getDictionary } from "../lib/i18n";

const DIR = join(__dirname, "..", "lib", "dictionaries");

/** Every key path in an object, so a missing or renamed key is visible. */
function paths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return [`${prefix}[]`];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      paths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

const expected = paths(en).sort();
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

describe("dictionaries", () => {
  it("ships one file per language in LANGUAGES", () => {
    const shipped = new Set(files.map((f) => f.replace(".json", "")));
    const missing = LANGUAGES.map((l) => l.code).filter((code) => !shipped.has(code));
    expect(missing).toEqual([]);
  });

  it("has no dictionary for a language the app does not list", () => {
    const codes = new Set<string>(LANGUAGES.map((l) => l.code));
    expect(files.map((f) => f.replace(".json", "")).filter((c) => !codes.has(c))).toEqual([]);
  });

  for (const file of files) {
    it(`${file} matches the English key structure exactly`, () => {
      const dict = JSON.parse(readFileSync(join(DIR, file), "utf8"));
      expect(paths(dict).sort()).toEqual(expected);
    });

    it(`${file} keeps every {placeholder} the English string declares`, () => {
      const dict = JSON.parse(readFileSync(join(DIR, file), "utf8"));
      // A dropped {price} or {author} renders a sentence with a hole in it.
      const placeholders = (obj: unknown, src: unknown): void => {
        if (typeof src === "string") {
          const want = [...src.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
          const got = typeof obj === "string"
            ? [...obj.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
            : [];
          expect(got).toEqual(want);
          return;
        }
        if (src && typeof src === "object" && !Array.isArray(src)) {
          for (const [key, child] of Object.entries(src)) {
            placeholders((obj as Record<string, unknown>)?.[key], child);
          }
        }
      };
      placeholders(dict, en);
    });
  }
});

describe("getDictionary", () => {
  it("returns English for an unknown language rather than throwing", async () => {
    await expect(getDictionary("xx")).resolves.toBe(en);
  });

  it("loads a translation and keeps the English key structure", async () => {
    const it_ = await getDictionary("it");
    expect(it_.product.buyFor).toContain("{price}");
    expect(paths(it_).sort()).toEqual(expected);
  });
});
