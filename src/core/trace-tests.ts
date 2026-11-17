import type { TestEntry } from "./trace-types.js";

const BS = "\\";

/** `it(` / `test(` with an optional `.only`/`.skip`/`.todo`/`.skipIf(..)` form; `.each` is not expanded. */
const CALL = new RegExp(
  String.raw`\b(?:it|test)(\.(?:only|skip|todo|concurrent|sequential|fails|skipIf\([^)]*\)|runIf\([^)]*\)))?\s*\(\s*` +
    `(?:(["'])((?:${BS}${BS}.|(?!${BS}2).)*)${BS}2|` +
    "`" +
    `((?:${BS}${BS}.|[^` +
    "`" +
    `${BS}${BS}])*)` +
    "`)",
  "g",
);

const UNESCAPE = new RegExp(`${BS}${BS}(["'${"`"}${BS}${BS}])`, "g");

/**
 * Extract test titles and skip state from test source text (a text scan, not an AST). Titles with
 * `${…}` interpolation are returned as written, so they simply cite nothing. `.each` titles are not
 * expanded and are not returned. A conditional `.skipIf(...)` is not treated as skipped.
 */
export function extractTests(file: string, source: string): TestEntry[] {
  const out: TestEntry[] = [];
  CALL.lastIndex = 0;
  for (let m = CALL.exec(source); m; m = CALL.exec(source)) {
    const mod = m[1] ?? "";
    const title = (m[3] ?? m[4] ?? "").replace(UNESCAPE, "$1");
    const line = source.slice(0, m.index).split("\n").length;
    out.push({ file, line, title, skipped: mod === ".skip" || mod === ".todo" });
  }
  return out;
}
