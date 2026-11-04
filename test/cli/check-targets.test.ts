import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CheckCommand } from "../../src/cli/check.js";
import { SyncCommand } from "../../src/cli/sync.js";
import { TARGETS } from "../../src/emitters/index.js";
import { emitFiles } from "../helpers/emit-target.js";
import { runCommand } from "../helpers/run-command.js";

/** `ambykit check` covers every new target: present → clean, hand edit → drift (feature 016, FR-012). */

const NEW = ["gemini", "llxprt", "qwen", "kilo", "augment", "windsurf", "kiro", "pi"];

function project(tools: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-check-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools }));
  writeFileSync(join(root, ".amby", "constitution.md"), "# Constitution\n");
  return root;
}

describe("ambykit check per new target", () => {
  it("every new target is registered, and Pi is the only alias among them", () => {
    for (const id of NEW) expect(TARGETS.some((t) => t.id === id), id).toBe(true);
    expect(TARGETS.filter((t) => NEW.includes(t.id) && t.alias).map((t) => t.id)).toEqual(["pi"]);
    expect(TARGETS).toHaveLength(18);
  });

  describe.each(NEW)("%s", (id) => {
    it("is clean after sync and reports drift after a hand edit", async () => {
      const root = project([id]);
      expect((await runCommand(new SyncCommand(), root, [])).code).toBe(0);

      const clean = await runCommand(new CheckCommand(), root, []);
      expect(clean.code, clean.out + clean.err).toBe(0);

      const command = emitFiles([id]).find((f) => f.path.includes("specify"))!.path;
      appendFileSync(join(root, command), "\nhand edit\n");
      const drift = await runCommand(new CheckCommand(), root, []);
      expect(drift.code).toBe(1);
      expect(drift.out + drift.err).toContain(command);
    });

    it("notices a deleted command file", async () => {
      const root = project([id]);
      await runCommand(new SyncCommand(), root, []);
      const command = emitFiles([id]).find((f) => f.path.includes("plan"))!.path;
      const { rmSync } = await import("node:fs");
      rmSync(join(root, command));
      const r = await runCommand(new CheckCommand(), root, []);
      expect(r.code).toBe(1);
      expect(r.out + r.err).toContain(command);
    });
  });

  it("names the owners of an output shared by Codex and Pi (FR-007)", async () => {
    const root = project(["codex", "pi"]);
    await runCommand(new SyncCommand(), root, []);
    const r = await runCommand(new CheckCommand(), root, []);
    expect(r.code).toBe(0);
    expect(r.out + r.err).toContain("Shared output .agents/skills/ is owned by: codex, pi");
  });

  it("stays quiet about sharing when nothing is shared", async () => {
    const root = project(["codex", "kiro"]);
    await runCommand(new SyncCommand(), root, []);
    expect((await runCommand(new CheckCommand(), root, [])).out).not.toContain("Shared output");
  });
});
