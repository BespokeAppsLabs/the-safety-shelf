// Convex storage URLs carry no filename and serve the image inline, so a
// download needs a name invented for it. Extension comes from the URL when it
// has one; jpg is the fallback because that is what the cover pipeline writes.
export function coverFileName(url: string, slug: string) {
  const ext = /\.(jpe?g|png|webp|avif|gif)(?:[?#]|$)/i.exec(url)?.[1];
  return `${slug}-cover.${ext ? ext.toLowerCase() : "jpg"}`;
}
