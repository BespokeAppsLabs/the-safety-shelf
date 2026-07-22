// Converts between flat bookBlocks and the chapter-oriented editor shape.
import type { Id } from "../convex/_generated/dataModel";

export type Chapter = { heading: string; body: string; imageStorageId?: Id<"_storage">; imageUrl?: string | null };

type Block = { chapter: number; ord: number; type: "h" | "p" | "img"; text?: string; imgStorageId?: Id<"_storage">; imageUrl?: string | null };
export type TextBlock = { chapter: number; ord: number; type: "h" | "p"; text: string };
export type ImageBlock = { chapter: number; ord: number; type: "img"; imgStorageId: Id<"_storage"> };

export function blocksToChapters(blocks: Block[]): Chapter[] {
  const byChapter = new Map<number, Chapter & { paras: string[] }>();
  for (const block of [...blocks].sort((a, b) => a.chapter - b.chapter || a.ord - b.ord)) {
    const entry = byChapter.get(block.chapter) ?? { heading: "", body: "", paras: [] };
    if (block.type === "h") entry.heading = block.text ?? "";
    else if (block.type === "p") entry.paras.push(block.text ?? "");
    else if (block.imgStorageId) {
      entry.imageStorageId = block.imgStorageId;
      entry.imageUrl = block.imageUrl ?? null;
    }
    byChapter.set(block.chapter, entry);
  }
  return [...byChapter.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, { paras, ...entry }]) => ({ ...entry, body: paras.join("\n\n") }));
}

export function chaptersToBlocks(chapters: Chapter[]): Array<TextBlock | ImageBlock> {
  const blocks: Array<TextBlock | ImageBlock> = [];
  chapters.forEach((chapter, index) => {
    const chapterNo = index + 1;
    if (chapter.heading.trim()) blocks.push({ chapter: chapterNo, ord: 0, type: "h", text: chapter.heading.trim() });
    let ord = 1;
    if (chapter.imageStorageId) blocks.push({ chapter: chapterNo, ord: ord++, type: "img", imgStorageId: chapter.imageStorageId });
    chapter.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      .forEach((text) => blocks.push({ chapter: chapterNo, ord: ord++, type: "p", text }));
  });
  return blocks;
}

// Total characters of narratable text — used to size an audiobook against the
// ElevenLabs per-request limit.
export function chapterCharacters(chapters: Chapter[]): number {
  return chapters.reduce((sum, c) => sum + c.heading.length + c.body.length, 0);
}
