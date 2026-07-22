"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { Chapter } from "@/lib/bookContent";

// Controlled chapter/paragraph editor shared by the original Content tab and
// each translated variant. Paragraphs are blank-line separated within a body.
export function ChapterEditor({
  chapters,
  onChange,
  renderImageControls,
}: {
  chapters: Chapter[];
  onChange: (chapters: Chapter[]) => void;
  renderImageControls?: (chapter: Chapter, index: number) => ReactNode;
}) {
  function patch(index: number, part: Partial<Chapter>) {
    onChange(chapters.map((c, i) => (i === index ? { ...c, ...part } : c)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Separate paragraphs with a blank line. Chapters are numbered in order.</p>
        <Button size="sm" variant="ghost" onClick={() => onChange([...chapters, { heading: "", body: "" }])}>
          Add chapter
        </Button>
      </div>
      {chapters.map((chapter, index) => (
        <div key={index} className="space-y-2 rounded-3xl bg-background p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Ch. {index + 1}</span>
            <Input placeholder="Chapter heading" value={chapter.heading} onChange={(e) => patch(index, { heading: e.target.value })} />
            <button
              onClick={() => onChange(chapters.filter((_, i) => i !== index))}
              className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-muted transition hover:bg-white hover:text-red-strong"
            >
              Remove
            </button>
          </div>
          <Textarea className="min-h-32" placeholder="Chapter text…" value={chapter.body} onChange={(e) => patch(index, { body: e.target.value })} />
          {renderImageControls?.(chapter, index)}
        </div>
      ))}
      {chapters.length === 0 ? <p className="text-sm text-muted">No chapters yet — add one to start.</p> : null}
    </div>
  );
}
