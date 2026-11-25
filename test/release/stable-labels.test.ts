import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RUN_STABILITY, stabilityLabel } from "../../src/core/run-stability.js";

/**
 * 034:FR-012 — README, `docs/` and the site describe the release: the plugin API carries no "experimental" label (it is stable from
 * 2.0), `ambykit run` carries one only while `RUN_STABILITY` is `"experimental"` and then only the label 033 emits (decision D-5,
 * so this test never contradicts 033 T072), and 1.x is mentioned as supported until 2.1.
 */
const root = resolve(__dirname, "..", "..");

function walk(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name), ext) : ext.test(e.name) ? [join(dir, e.name)] : []));
}
const pages = [join(root, "README.md"), ...walk(join(root, "docs"), /\.md$/), ...walk(join(root, "site", "src", "content", "docs"), /\.mdx?$/)];

interface Hit {
  file: string;
  line: number;
  text: string;
  heading: string;
}

/** Every line that says "experimental", with the heading it sits under. */
function hits(): Hit[] {
  const out: Hit[] = [];
  for (const file of pages) {
    let heading = "";
    readFileSync(file, "utf8").split(/\r?\n/).forEach((text, i) => {
      if (/^#{1,6} /.test(text)) heading = text;
      if (/experimental/i.test(text)) out.push({ file: relative(root, file).replace(/\\/g, "/"), line: i + 1, text, heading });
    });
  }
  return out;
}

/** A line of version history ("- 1.x: experimental.") describes the past, not the release. */
const history = (h: Hit) => /^\s*- 1\.x: experimental\.?\s*$/.test(h.text);
const aboutRun = (h: Hit) => /`ambykit run|\bruns?\b|fleets?|runners?/i.test(h.text) || /`ambykit run|fleets?|runners?/i.test(h.heading);
const where = (h: Hit) => `${h.file}:${h.line}: ${h.text.trim()}`;

describe("stable labels (034, US-7)", () => {
  it("034:FR-012: the plugin API is never labelled experimental, except in its version history", () => {
    const bad = hits().filter((h) => !history(h) && !/plugin API is stable/i.test(h.text) && /plugin[ -]api|PLUGIN_API/i.test(h.text + " " + (aboutRun(h) ? "" : h.heading)));
    expect(bad.map(where)).toEqual([]);
  });

  it("034:FR-012: an experimental label is only about ambykit run, and only while RUN_STABILITY is experimental (D-5)", () => {
    const labels = hits().filter((h) => !history(h));
    if (RUN_STABILITY === "stable") {
      expect(labels.map(where), "run is stable: drop every experimental label").toEqual([]);
      return;
    }
    expect(labels.filter((h) => !aboutRun(h)).map(where)).toEqual([]);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("034:FR-012: a heading's label is exactly the one 033 emits", () => {
    const label = stabilityLabel();
    for (const h of hits().filter((x) => /^#{1,6} /.test(x.text))) {
      if (label === "") expect.fail(`run is stable but ${where(h)} still has a label`);
      expect(h.text, where(h)).toMatch(new RegExp(`\\${label.slice(0, -1)}\\)\\s*$`));
    }
  });

  it("034:FR-012: README, docs and site say 1.x is read until 2.1", () => {
    const say = (file: string) => /1\.x[^\n]*until 2\.1|until 2\.1[^\n]*1\.x|2\.1 stops reading 1\.x/i.test(readFileSync(join(root, file), "utf8"));
    expect(say("README.md"), "README").toBe(true);
    expect(say("docs/migration.md"), "docs/migration.md").toBe(true);
    expect(say("site/src/content/docs/cli/index.mdx"), "site CLI page").toBe(true);
  });

  it("034:FR-012: no page still calls a release older than 2.0 the current one for run", () => {
    expect(hits().filter((h) => /experimental in 1\.\d/i.test(h.text)).map(where)).toEqual([]);
  });
});
