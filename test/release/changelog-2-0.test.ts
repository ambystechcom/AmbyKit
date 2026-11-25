import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RUN_STABILITY } from "../../src/core/run-stability.js";

/**
 * 034:FR-001 — the 2.0 changelog block groups every breaking change into one Breaking changes list, each entry saying who is
 * affected and what to do, and the `[plugin-api]` line says the API is stable. The block is `[Unreleased]` until the release
 * branch retitles it `[2.0.0]` (T082), so the test reads whichever of the two comes first.
 */
const changelog = readFileSync(resolve(__dirname, "..", "..", "CHANGELOG.md"), "utf8").replace(/\r\n/g, "\n");

function releaseBlock(): string {
  const start = changelog.search(/^## \[(Unreleased|2\.0\.0)\]/m);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = changelog.slice(start + 3);
  const end = rest.search(/^## \[/m);
  return end < 0 ? rest : rest.slice(0, end);
}

function breakingEntries(): string[] {
  const block = releaseBlock();
  const at = block.indexOf("### Breaking changes");
  expect(at, "the 2.0 block has a Breaking changes list").toBeGreaterThanOrEqual(0);
  const section = block.slice(at).split(/\n### /)[0]!;
  return section.split(/\n(?=- \*\*)/).filter((e) => e.startsWith("- **"));
}

/** The six breaking changes of US-1, each found by what its entry must name. */
const BREAKING: Array<[string, RegExp]> = [
  ["spec format v2 and migrate", /format v2[\s\S]*ambykit migrate/i],
  ["config schema version", /schemaVersion/],
  ["Node 22 minimum", /Node 22/],
  ["ambykit run", /`ambykit run`/],
  ["stable plugin API and its deprecation policy", /plugin API stable[\s\S]*deprecated/i],
  ["targets moved to official plugins", /moved to an official plugin[\s\S]*ambykit-emitter-antigravity/i],
];

describe("2.0 changelog (034, US-1)", () => {
  it("034:FR-001: the Breaking changes list comes before Added and Changed and holds exactly the six US-1 items", () => {
    const block = releaseBlock();
    expect(block.indexOf("### Breaking changes")).toBeLessThan(block.indexOf("### Added"));
    const entries = breakingEntries();
    expect(entries).toHaveLength(BREAKING.length);
    for (const [name, pattern] of BREAKING) expect(entries.filter((e) => pattern.test(e)).length, name).toBeGreaterThanOrEqual(1);
  });

  it("034:FR-001: every breaking change says who is affected and what to do", () => {
    for (const e of breakingEntries()) {
      expect(e, e.slice(0, 60)).toMatch(/Who is affected: \S/);
      expect(e, e.slice(0, 60)).toMatch(/What to do: \S/);
    }
  });

  it("034:FR-001: the run entry matches RUN_STABILITY (decision D-5)", () => {
    const run = breakingEntries().find((e) => /`ambykit run`/.test(e))!;
    if (RUN_STABILITY === "experimental") expect(run).toMatch(/still labelled experimental/);
    else expect(run).not.toMatch(/experimental/);
  });

  it("034:FR-001: the [plugin-api] line says the API is stable", () => {
    expect(releaseBlock()).toMatch(/^- `\[plugin-api\]` The plugin API is \*\*stable from 2\.0\*\*/m);
    expect(releaseBlock()).toMatch(/^Plugins: affected/m);
  });
});
