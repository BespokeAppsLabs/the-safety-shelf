import type { Doc } from "@/convex/_generated/dataModel";

// Formats are derived from storage-id presence, never stored — see
// docs/05-data-model.md "Formats are derived, not stored".
export function bookFormats(book: Doc<"books">): string[] {
  const formats = ["Reader"];
  if (book.epubStorageId) formats.push("EPUB");
  if (book.pdfStorageId) formats.push("PDF");
  return formats;
}
