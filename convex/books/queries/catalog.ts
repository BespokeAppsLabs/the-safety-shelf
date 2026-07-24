import { viewerQuery, requireOwner } from "../../lib/auth";
import { isSavedTranslation } from "../../../lib/translationState";

// Catalog rows — one per book, augmented with the languages it exists in as
// text (original + variants) and as audio (distinct bookAudio langs; rows with
// no lang predate multi-language audio and count as the original). Powers the
// language/audio tags on /admin/books.
export const catalog = viewerQuery({
  args: {},
  handler: async (ctx) => {
    requireOwner(ctx.viewer);

    const [books, variants, audio] = await Promise.all([
      ctx.db.query("books").collect(),
      ctx.db.query("bookVariants").collect(),
      ctx.db.query("bookAudio").collect(),
    ]);

    return books.map((book) => {
      const textLangs = [
        book.originalLang,
        ...variants.filter((variant) => variant.bookId === book._id && isSavedTranslation(variant)).map((variant) => variant.lang),
      ];
      const audioLangs = audio
        .filter((row) => row.bookId === book._id)
        .map((row) => row.lang ?? book.originalLang);

      return {
        ...book,
        textLangs: [...new Set(textLangs)],
        audioLangs: [...new Set(audioLangs)],
      };
    });
  },
});
