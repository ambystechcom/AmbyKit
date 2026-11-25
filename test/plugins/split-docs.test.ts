import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PLANNED_DEPRECATED_TARGETS, PLANNED_MOVED_TARGETS, targetStatus } from "../../src/core/moved-targets.js";
import { TARGETS } from "../../src/emitters/index.js";

/** Feature 036, T054 (FR-011): the docs and the registry agree on which targets are built in and which come from a plugin. */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), "utf8").replace(/\r\n/g, "\n");

describe("the docs mark each target built in or official plugin (036:FR-011)", () => {
  it("036:FR-011: the README names the plugin for Antigravity and lists the built-in products", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/\*\*Official plugin:\*\* Antigravity \(IDE \+ CLI\), `@ambystech\/ambykit-emitter-antigravity`/);
    for (const name of ["Claude Code", "GitHub Copilot", "OpenCode", "Cursor", "Codex CLI"]) expect(readme, name).toContain(name);
    for (const name of ["Gemini CLI", "Windsurf", "Qwen Code", "Kiro", "Kilo Code", "Augment Code", "LLxprt Code"]) expect(readme, name).toContain(name);
  });

  it("036:FR-011: docs/tool-compatibility.md gives the plugin, not an emitter class, for the two moved targets", () => {
    const doc = read("docs", "tool-compatibility.md");
    for (const id of Object.keys(PLANNED_MOVED_TARGETS)) {
      const m = PLANNED_MOVED_TARGETS[id]!;
      expect(doc, id).toContain(`official plugin \`${m.package}\``);
    }
    expect(doc).not.toMatch(/AntigravityEmitter|AntigravityCliEmitter/);
  });

  it("036:FR-011: docs/plugin-split.md marks every registry id built in, plugin candidate or official plugin, in agreement with targetStatus", () => {
    const rows = read("docs", "plugin-split.md").split("\n").filter((l) => /^\| `[a-z-]+` \|/.test(l));
    for (const row of rows) {
      const id = /^\| `([a-z-]+)`/.exec(row)![1]!;
      const state = id in PLANNED_MOVED_TARGETS ? "moved" : id in PLANNED_DEPRECATED_TARGETS ? "deprecated" : "built-in";
      expect(row, id).toMatch(state === "moved" ? /official plugin/ : state === "deprecated" ? /plugin candidate/ : /built in/);
      if (TARGETS.some((t) => t.id === id)) expect(targetStatus(id).state, id).toBe(state);
    }
  });
});
