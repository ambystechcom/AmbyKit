import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MigrateCommand, LOSS_NOTICE } from "../../src/cli/migrate.js";
import { migrateProject } from "../../src/core/migrate/run.js";
import { readSpec, readTasks } from "../../src/core/spec-format/dispatch.js";
import { storyOut, taskOut } from "../helpers/spec-model.js";
import { runCommand } from "../helpers/run-command.js";
import { fixture, tempProject } from "../helpers/spec-project.js";
import { hashTree, listFiles } from "../helpers/tree-hash.js";

const V1 = {
  "900-edge-rich": { "spec.md": fixture("edge-rich", "spec.v1.md"), "tasks.md": fixture("edge-rich", "tasks.v1.md") },
  "901-small": {
    "spec.md": "---\nfeature: 901-small\n---\n\n### US-1 — One  (priority: P1)\n\n- **status:** done\n",
    "tasks.md": "## Phase 1 — Go\n\n- [x] [T001] [US1] do it (src/a.ts)\n- **Verify:** `npm test` ✓ passed\n",
  },
};
const read = (dir: string, f: string, file: string): string => readFileSync(join(dir, "specs", f, file), "utf8");
const migrate = (dir: string, positionals: string[] = [], flags: Record<string, string | boolean> = {}) =>
  runCommand(new MigrateCommand(), dir, positionals, flags);

describe("migrate end to end (030, US-3, US-4)", () => {
  it("030:FR-005: converts every 1.x spec and tasks file, and each reads back to the same model", async () => {
    const dir = tempProject(V1);
    const before = { spec: readSpec("900-edge-rich", V1["900-edge-rich"]["spec.md"]).stories.map(storyOut), tasks: readTasks(V1["900-edge-rich"]["tasks.md"]).tasks.map((t) => taskOut(t)) };
    const r = await migrate(dir);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/Total: 4 converted, 0 unchanged, 0 skipped/);
    const spec = readSpec("900-edge-rich", read(dir, "900-edge-rich", "spec.md"));
    const tasks = readTasks(read(dir, "900-edge-rich", "tasks.md"));
    expect(spec.format).toBe(2);
    expect(tasks.format).toBe(2);
    expect(spec.stories.map(storyOut)).toEqual(before.spec);
    expect(tasks.tasks.map((t) => taskOut(t, false)).map((t) => ({ ...t, description: undefined }))).toEqual(before.tasks.map((t) => ({ ...t, description: undefined })));
  });

  it("030:FR-009: a second run changes nothing", async () => {
    const dir = tempProject(V1);
    await migrate(dir);
    const hash = hashTree(dir);
    const again = await migrate(dir);
    expect(hashTree(dir)).toBe(hash);
    expect(again.out).toMatch(/Total: 0 converted, 4 unchanged, 0 skipped/);
    expect(again.out).toMatch(/Nothing to migrate/);
  });

  it("030:FR-007: --dry-run leaves the tree byte-identical, creates no temp file, and says what would change", async () => {
    const dir = tempProject(V1);
    const hash = hashTree(dir);
    const r = await migrate(dir, [], { "dry-run": true });
    expect(hashTree(dir)).toBe(hash);
    expect(listFiles(dir).filter((f) => f.endsWith(".migrate-tmp"))).toEqual([]);
    expect(r.out.split("\n")[0]).toMatch(/Dry run: nothing was written/);
    expect(r.out).toContain("would convert");
    expect(r.out).toMatch(/Config: would add schemaVersion 2/);
  });

  it("030:FR-008: the summary names each feature with its lines added and removed, and a notice about 1.x tools", async () => {
    const dir = tempProject(V1);
    const r = await migrate(dir);
    expect(r.out).toMatch(/900-edge-rich {2}\(\+\d+ -\d+\)/);
    expect(r.out).toMatch(/spec\.md {2}converted {2}\+\d+ -\d+/);
    expect(r.out).toContain("stripped 2 (priority: Pn) annotations from headings");
    expect(r.out).toContain(LOSS_NOTICE);
  });

  it("030:FR-007: --diff appends a unified diff of each converted file", async () => {
    const dir = tempProject({ "901-small": V1["901-small"] });
    const r = await migrate(dir, [], { "dry-run": true, diff: true });
    expect(r.out).toContain("--- a/specs/901-small/spec.md");
    expect(r.out).toContain("+++ b/specs/901-small/spec.md");
    expect(r.out).toMatch(/^\+format: 2/m);
    expect(r.out).toMatch(/^-- \*\*status:\*\* done/m);
  });

  it("030:FR-005: a feature argument (number or name) migrates only that feature", async () => {
    const dir = tempProject(V1);
    await migrate(dir, ["901"]);
    expect(readSpec("901-small", read(dir, "901-small", "spec.md")).format).toBe(2);
    expect(read(dir, "900-edge-rich", "spec.md")).toBe(V1["900-edge-rich"]["spec.md"]);
    const none = await migrate(dir, ["999"]);
    expect(none.code).toBe(1);
    expect(none.err).toMatch(/No feature matches "999"/);
  });

  it("030:FR-014: the config gets schemaVersion 2 with every setting kept, and a dry run leaves it alone", async () => {
    const dir = tempProject(V1, { version: "1.5.0", tools: ["claude"], future: { a: 1 } });
    const cfg = join(dir, ".amby", "config.json");
    const raw = readFileSync(cfg, "utf8");
    await migrate(dir, [], { "dry-run": true });
    expect(readFileSync(cfg, "utf8")).toBe(raw);
    await migrate(dir);
    const after = JSON.parse(readFileSync(cfg, "utf8")) as Record<string, unknown>;
    expect(after).toMatchObject({ version: "1.5.0", schemaVersion: 2, tools: ["claude"], future: { a: 1 } });
  });

  it("030:FR-014: a newer or unparseable config is left unmodified and reported", async () => {
    const newer = tempProject(V1, { version: "9.0.0", schemaVersion: 3 });
    const text = readFileSync(join(newer, ".amby", "config.json"), "utf8");
    const r = await migrate(newer);
    expect(readFileSync(join(newer, ".amby", "config.json"), "utf8")).toBe(text);
    expect(r.err + r.out).toMatch(/newer AmbyKit/);
    const broken = tempProject(V1);
    writeFileSync(join(broken, ".amby", "config.json"), "{ nope");
    const b = await migrate(broken);
    expect(readFileSync(join(broken, ".amby", "config.json"), "utf8")).toBe("{ nope");
    expect(b.err + b.out).toMatch(/not valid JSON/);
  });

  it("030:FR-005: other worktrees and checkouts under the project are never touched", async () => {
    const dir = tempProject(V1);
    const other = join(dir, ".worktrees", "other", "specs", "950-other");
    mkdirSync(other, { recursive: true });
    const text = "### US-1 — X\n\n- **status:** done\n";
    writeFileSync(join(other, "spec.md"), text);
    await migrate(dir);
    expect(readFileSync(join(other, "spec.md"), "utf8")).toBe(text);
  });

  it("030:FR-023: --dual-write keeps the 1.x lines, adds the v2 data, and reports the files as transitional", async () => {
    const dir = tempProject({ "901-small": V1["901-small"] });
    const r = await migrate(dir, [], { "dual-write": true });
    expect(read(dir, "901-small", "spec.md")).toContain("- **status:** done");
    expect(read(dir, "901-small", "spec.md")).toMatch(/^stories:/m);
    expect(read(dir, "901-small", "tasks.md")).toContain("(src/a.ts)");
    expect(read(dir, "901-small", "tasks.md")).toMatch(/^```yaml/m);
    expect(r.out).toContain("transitional");
  });

  it("030:FR-011: uncommitted changes in files migrate converts are named in a warning, and migrate still runs", async () => {
    const dir = tempProject({ "901-small": V1["901-small"] });
    const git = (...a: string[]) => execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", ...a], { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "init");
    writeFileSync(join(dir, "specs", "901-small", "spec.md"), V1["901-small"]["spec.md"] + "\nExtra uncommitted line.\n");
    const r = await migrate(dir);
    expect(r.err).toMatch(/uncommitted changes.*specs\/901-small\/spec\.md/);
    expect(readSpec("901-small", read(dir, "901-small", "spec.md")).format).toBe(2);
  });

  it("030:FR-005: the API result carries counts and a summary (used by the parity helpers)", () => {
    const dir = tempProject(V1);
    const res = migrateProject(dir, {});
    expect(res.counts).toEqual({ converted: 4, unchanged: 0, skipped: 0 });
    expect(res.summary).toMatch(/Total: 4 converted/);
    expect(res.config.written).toBe(true);
  });
});
