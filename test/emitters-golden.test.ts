import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { emitTarget } from "./helpers/emit-target.js";

/**
 * Golden output of the ten pre-existing targets (feature 016, FR-010 / SC-004). Recorded before the
 * emitter refactor; every later change must leave these files byte-identical. To re-record after an
 * intentional change to a neutral prompt: `UPDATE_GOLDEN=1 npx vitest run test/emitters-golden.test.ts`.
 */
const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "emitters-golden");
const EXISTING = [
  "claude",
  "claude-vscode",
  "copilot",
  "copilot-cli",
  "opencode",
  "cursor",
  "cursor-cli",
  "antigravity",
  "antigravity-cli",
  "codex",
];

/**
 * Line endings are not part of the contract: a Windows checkout (git autocrlf) reads the neutral
 * prompts with CRLF, Linux and macOS with LF. Compare and record with LF only.
 */
type Emitted = Record<string, string>;
const lf = (files: Emitted): Emitted => Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.replaceAll("\r\n", "\n")]));

describe("existing targets stay byte-identical (FR-010, SC-004)", () => {
  for (const id of EXISTING) {
    it(`${id}: every file, with and without roles`, () => {
      const actual = { plain: lf(emitTarget(id)), roles: lf(emitTarget(id, { roles: true })) };
      const file = join(DIR, `${id}.json`);
      if (process.env["UPDATE_GOLDEN"] === "1") {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(file, JSON.stringify(actual, null, 2) + "\n");
      }
      const raw = JSON.parse(readFileSync(file, "utf8")) as typeof actual;
      const golden = { plain: lf(raw.plain), roles: lf(raw.roles) };
      expect(Object.keys(actual.plain)).toEqual(Object.keys(golden.plain));
      expect(actual).toEqual(golden);
    });
  }
});
