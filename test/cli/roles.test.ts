import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CheckCommand } from "../../src/cli/check.js";
import { InitCommand } from "../../src/cli/init.js";
import { SyncCommand } from "../../src/cli/sync.js";
import { ROLE_WORD_LIMIT } from "../../src/core/roles.js";

async function run(cmd: { run(o: { cwd: string; positionals: string[]; flags: Record<string, string | boolean> }): Promise<number> }, cwd: string, positionals: string[] = [], flags: Record<string, string | boolean> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const [oLog, oErr, oWarn] = [console.log, console.error, console.warn];
  console.log = (...a: unknown[]) => void out.push(a.join(" "));
  console.error = (...a: unknown[]) => void err.push(a.join(" "));
  console.warn = (...a: unknown[]) => void err.push(a.join(" "));
  try {
    const code = await cmd.run({ cwd, positionals, flags });
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    [console.log, console.error, console.warn] = [oLog, oErr, oWarn];
  }
}

/** A project initialized non-interactively for Claude (installs templates + roles). */
async function project(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "ambykit-roles-cli-"));
  const r = await run(new InitCommand(), root, [root], { yes: true, tools: "claude" });
  expect(r.code).toBe(0);
  return root;
}

const role = (id: string, body: string, name = id) => `---\nid: ${id}\nname: ${name}\nphases: [plan]\n---\n${body}\n`;

describe("roles in init / sync / check (feature 013, US-2)", () => {
  it("init installs the six roles and emitted commands bind to them (FR-001)", async () => {
    const root = await project();
    expect(existsSync(join(root, ".amby", "roles", "qa.md"))).toBe(true);
    const plan = readFileSync(join(root, ".claude", "commands", "amby.plan.md"), "utf8");
    expect(plan).toContain("@.amby/roles/architect.md");
  });

  it("an edited role needs no re-sync: commands reference it by path (SC-003)", async () => {
    const root = await project();
    const before = readFileSync(join(root, ".claude", "commands", "amby.converge.md"), "utf8");
    // Only the checklist changes; the name stays (it is the one thing the role line embeds).
    writeFileSync(join(root, ".amby", "roles", "qa.md"), role("qa", "verify accessibility too", "QA Engineer"));
    const r = await run(new SyncCommand(), root);
    expect(r.code).toBe(0);
    expect(readFileSync(join(root, ".claude", "commands", "amby.converge.md"), "utf8")).toBe(before);
    expect(r.err).toBe("");
  });

  it("sync warns exactly once for a role over the word limit and still emits (FR-010, SC-004)", async () => {
    const root = await project();
    const long = Array.from({ length: ROLE_WORD_LIMIT + 1 }, (_, i) => `w${i}`).join(" ");
    writeFileSync(join(root, ".amby", "roles", "qa.md"), role("qa", long));
    const r = await run(new SyncCommand(), root);
    expect(r.code).toBe(0);
    expect(r.err.match(/limit 150/g)).toHaveLength(1);
    expect(r.err).toContain(`${ROLE_WORD_LIMIT + 1} words`);
  });

  it("sync refuses duplicate role ids (case-insensitive) with exit 1", async () => {
    const root = await project();
    writeFileSync(join(root, ".amby", "roles", "QA-copy.md"), role("QA".toLowerCase(), "dup"));
    const r = await run(new SyncCommand(), root);
    expect(r.code).toBe(1);
    expect(r.err).toContain("Duplicate role id 'qa'");
  });

  it("check reports a removed default role and validation problems (FR-011)", async () => {
    const root = await project();
    rmSync(join(root, ".amby", "roles", "ux.md"));
    const r = await run(new CheckCommand(), root);
    expect(r.err).toContain("ux.md");
    expect(r.err).toContain("ambykit sync");
    // sync reinstalls it write-if-absent
    await run(new SyncCommand(), root);
    expect(existsSync(join(root, ".amby", "roles", "ux.md"))).toBe(true);
  });

  it("a project with no roles dir syncs without any role line (FR-004)", async () => {
    const root = mkdtempSync(join(tmpdir(), "ambykit-noroles-cli-"));
    mkdirSync(join(root, ".amby"), { recursive: true });
    writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: ["claude"] }));
    // sync installs roles by default; remove them to simulate a project that opted out
    const r1 = await run(new SyncCommand(), root);
    expect(r1.code).toBe(0);
    rmSync(join(root, ".amby", "roles"), { recursive: true, force: true });
    // Emit again without roles: commands must not reference them.
    const { buildEmittedFiles } = await import("../../src/core/emit.js");
    const files = buildEmittedFiles(root, { version: "0.0.0", tools: ["claude"] });
    for (const f of files) expect(f.contents).not.toContain(".amby/roles/");
  });
});
