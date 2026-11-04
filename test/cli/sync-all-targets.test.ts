import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// SC-005: editing one neutral prompt updates every target through sync, with no hand editing. The
// prompts directory is redirected to a temp copy so the repository's own prompts are never touched.
const copy = mkdtempSync(join(tmpdir(), "ambykit-prompts-"));
vi.mock("../../src/core/paths.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/core/paths.js")>();
  return { ...original, promptsDir: () => copy };
});

const { SyncCommand } = await import("../../src/cli/sync.js");
const { TARGETS } = await import("../../src/emitters/index.js");
const { buildEmittedFiles } = await import("../../src/core/emit.js");
const { runCommand } = await import("../helpers/run-command.js");
const original = (await vi.importActual<typeof import("../../src/core/paths.js")>("../../src/core/paths.js")).promptsDir();
cpSync(original, copy, { recursive: true });

const ALL = TARGETS.map((t) => t.id);
const MARK = "SC005-EDIT-MARKER";

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-all-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: ALL }));
  return root;
}

describe("one prompt edit reaches all 18 targets (SC-005)", () => {
  it("emits for every target, then reflects a prompt edit after one sync, and `sync --check` is clean", async () => {
    expect(ALL).toHaveLength(18);
    const root = project();
    expect((await runCommand(new SyncCommand(), root, [])).code).toBe(0);
    expect((await runCommand(new SyncCommand(), root, [], { check: true })).code).toBe(0);

    const file = join(copy, "specify.md");
    writeFileSync(file, readFileSync(file, "utf8").replace("\n1.", `\n${MARK}\n\n1.`));
    const stale = await runCommand(new SyncCommand(), root, [], { check: true });
    expect(stale.code).toBe(1); // the edit is visible as drift before syncing

    expect((await runCommand(new SyncCommand(), root, [])).code).toBe(0);
    expect((await runCommand(new SyncCommand(), root, [], { check: true })).code).toBe(0);

    const specify = buildEmittedFiles(root, { version: "0.0.0", tools: ALL }).filter((f) => /specify/.test(f.path));
    // Every target that has a command surface carries the edit; Cursor CLI is rules-only.
    const carrying = specify.filter((f) => f.contents.includes(MARK));
    expect(carrying.length).toBeGreaterThanOrEqual(10);
    for (const f of specify) {
      if (!f.path.startsWith(".cursor/")) expect(f.contents, f.path).toContain(MARK);
    }
  });
});
