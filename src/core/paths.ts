import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";

/**
 * Resolve the installed package root (where src/prompts and src/templates live).
 * Works both from compiled dist/ and when run through a loader against src/.
 */
export function packageRoot(): string {
  // this file is at <root>/src/core/paths.ts or <root>/dist/core/paths.js
  const here = dirname(fileURLToPath(import.meta.url));
  // walk up until we find a dir containing package.json
  let dir = here;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = dirname(dir);
  }
  // fallback: two levels up from core/
  return resolve(here, "..", "..");
}

/** Directory containing the neutral phase prompts. */
export function promptsDir(): string {
  return join(packageRoot(), "src", "prompts");
}

/** Directory containing the neutral artifact templates. */
export function templatesDir(): string {
  return join(packageRoot(), "src", "templates");
}

/** Directory containing on-demand reference docs (loaded by phases when needed). */
export function referenceDir(): string {
  return join(packageRoot(), "src", "reference");
}

/** Find the project root by walking up from `start` looking for an `.amby` dir. */
export function findProjectRoot(start: string = process.cwd()): string | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, ".amby"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
