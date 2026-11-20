import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";
import { CheckCommand } from "../../src/cli/check.js";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { MigrateCommand } from "../../src/cli/migrate.js";
import { runCommand } from "../helpers/run-command.js";
import { fixture, tempProject } from "../helpers/spec-project.js";

const OLD = { "spec.md": "---\nfeature: 901-old\n---\n\n### US-1 — Old\n\n- **status:** done\n", "tasks.md": "## Phase 1\n\n- [x] [T001] [US1] a (src/a.ts)\n" };
const OLD2 = { "spec.md": "---\nfeature: 902-old\n---\n\n### US-1 — Old two\n\n- **status:** ready\n", "tasks.md": "## Phase 1\n\n- [ ] [T001] [US1] b (src/b.ts)\n" };
const NEW = {
  "spec.md": "---\nformat: 2\nfeature: 903-new\nstories:\n  - id: US-1\n    status: draft\n---\n\n### US-1 — New\n",
  "tasks.md": "---\nformat: 2\n---\n## Phase 1\n\n- [ ] [T001] [US1] c\n```yaml\nfiles:\n  T001: [src/c.ts]\n```\n",
};

let written: string[] = [];
beforeEach(() => {
  written = [];
  vi.spyOn(process.stderr, "write").mockImplementation(((chunk: unknown) => {
    written.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);
  delete process.env["AMBYKIT_LEGACY_WARNING"];
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env["AMBYKIT_LEGACY_WARNING"];
});

const legacyLines = (): string[] => written.join("").split("\n").filter((l) => /1\.x spec format/.test(l));
const run = (cmd: AnalyzeCommand | DashboardCommand | CheckCommand | MigrateCommand, dir: string, flags: Record<string, string | boolean> = {}) =>
  runCommand(cmd, dir, [], flags);

describe("one 1.x warning per run (030, US-6, FR-012)", () => {
  it("030:FR-012: a 1.x project gets exactly one line on stderr, with the file count, however many features it has", async () => {
    const dir = tempProject({ "901-old": OLD, "902-old": OLD2 });
    await run(new AnalyzeCommand(), dir);
    expect(legacyLines()).toEqual(["4 files use the 1.x spec format (read as before). Run `ambykit migrate` to upgrade; support ends in 2.1."]);
  });

  it("030:FR-012: the warning never changes what the command prints", async () => {
    const dir = tempProject({ "901-old": OLD });
    const r = await run(new AnalyzeCommand(), dir);
    expect(r.out + r.err).not.toMatch(/1\.x spec format/);
    expect(legacyLines()).toHaveLength(1);
  });

  it("030:FR-012: --json output has no warning", async () => {
    const dir = tempProject({ "901-old": OLD });
    await run(new AnalyzeCommand(), dir, { json: true });
    await run(new DashboardCommand(), dir, { json: true });
    expect(legacyLines()).toEqual([]);
  });

  it("030:FR-012: legacyWarning: false in the config silences it", async () => {
    const dir = tempProject({ "901-old": OLD }, { version: "0.0.0", tools: [], legacyWarning: false });
    await run(new AnalyzeCommand(), dir);
    expect(legacyLines()).toEqual([]);
  });

  it("030:FR-012: AMBYKIT_LEGACY_WARNING=0 silences it", async () => {
    process.env["AMBYKIT_LEGACY_WARNING"] = "0";
    const dir = tempProject({ "901-old": OLD });
    await run(new AnalyzeCommand(), dir);
    expect(legacyLines()).toEqual([]);
  });

  it("030:FR-012: a project that is already v2 prints nothing", async () => {
    const dir = tempProject({ "903-new": NEW });
    await run(new AnalyzeCommand(), dir);
    expect(legacyLines()).toEqual([]);
  });

  it("030:SC-005: a mixed project reads together in analyze and the dashboard, with one warning that counts only the 1.x files", async () => {
    const dir = tempProject({ "901-old": OLD, "903-new": NEW });
    const analyze = JSON.parse((await run(new AnalyzeCommand(), dir, { json: true })).out) as { total: number };
    expect(analyze.total).toBe(2);
    expect(legacyLines()).toEqual([]);
    const dash = JSON.parse((await run(new DashboardCommand(), dir, { json: true })).out) as { feature: string }[];
    expect(dash.map((s) => s.feature).sort()).toEqual(["901-old", "903-new"]);
    await run(new AnalyzeCommand(), dir);
    expect(legacyLines()).toEqual(["2 files use the 1.x spec format (read as before). Run `ambykit migrate` to upgrade; support ends in 2.1."]);
  });

  it("030:FR-012: migrate does not print the warning (it is the fix and prints its own summary)", async () => {
    const dir = tempProject({ "901-old": OLD });
    await run(new MigrateCommand(), dir, { "dry-run": true });
    expect(legacyLines()).toEqual([]);
  });
});

describe("check lists the 1.x features (030, US-6, FR-019)", () => {
  it("030:FR-019: check names the features still on 1.x as a notice and keeps its exit status", async () => {
    const dir = tempProject({ "901-old": OLD, "902-old": OLD2, "903-new": NEW });
    const withOld = await run(new CheckCommand(), dir);
    const notice = withOld.out.split("\n").find((l) => /Notice:/.test(l));
    expect(notice).toMatch(/2 features still use the 1\.x spec format \(read as before\): 901-old, 902-old\. Run `ambykit migrate --dry-run`/);
    expect(legacyLines()).toEqual([]); // check prints its own notice above, not the shared one-line warning
    const onlyNew = tempProject({ "903-new": NEW });
    const clean = await run(new CheckCommand(), onlyNew);
    expect(clean.out).not.toMatch(/Notice:/);
    expect(withOld.code).toBe(clean.code);
  });

  it("030:FR-019: the notice is silenced by the same switches", async () => {
    process.env["AMBYKIT_LEGACY_WARNING"] = "0";
    const dir = tempProject({ "901-old": OLD });
    const r = await run(new CheckCommand(), dir);
    expect(r.out).not.toMatch(/Notice:/);
  });

  it("030:FR-019: the edge-rich fixtures count as expected (a 1.x tasks file and a 1.x spec)", async () => {
    const dir = tempProject({ "900-edge-rich": { "spec.md": fixture("edge-rich", "spec.v1.md"), "tasks.md": fixture("edge-rich", "tasks.v1.md") } });
    await run(new AnalyzeCommand(), dir);
    expect(legacyLines()[0]).toMatch(/^2 files use the 1\.x spec format/);
  });
});
