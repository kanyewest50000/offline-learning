// The shrine used to be one 260 KB inline <script> in index.html. It now lives
// in assets/js/shrine/, one file per part of the site. Source-level checks read
// the whole set through here so they keep working when a chunk moves file.

export const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

/** Load order, same as the <script> tags at the bottom of index.html. */
export const SHRINE_FILES = [
  "assets/js/shrine/config.js",
  "assets/js/shrine/games-catalog.js",
  "assets/js/shrine/originals.js",
  "assets/js/shrine/chat.js",
  "assets/js/shrine/casino.js",
  "assets/js/shrine/styles.js",
  "assets/js/shrine/markup.js",
  "assets/js/shrine/window.js",
] as const;

/** One shrine module, by repo-relative path. */
export function readShrineFile(name: string): Promise<string> {
  return Deno.readTextFile(`${ROOT}/${name}`);
}

/** Every shrine module concatenated — what index.html used to contain. */
export async function readShrine(): Promise<string> {
  const parts = await Promise.all(SHRINE_FILES.map(readShrineFile));
  return parts.join("\n");
}
