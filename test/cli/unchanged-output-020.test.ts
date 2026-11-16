import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { parseTasks } from "../../src/core/dashboard.js";
import { parsePhases } from "../../src/core/markers.js";

/**
 * SC-002 / FR-011 / FR-012 (feature 020): the shipped features (001-018, frozen) read exactly as they did
 * before the BLOCKED and Verify work. The fixture `unchanged-output-020.json` was recorded by running the
 * pre-020 code (the base commit 73e2826) against a copy of those features, so it is the real "before" and
 * not a snapshot of today's output: `analyze` (text, --json) and `dashboard` (one-shot, --icons=ascii,
 * --json, --json --overview). The first line of the one-shot dashboard (project path and version) is dropped.
 * The only difference allowed is the missing-Verify warning (`verifyIssues`), which finished features never raise.
 */
const root = join(import.meta.dirname, "..", "..");
const specsDir = join(root, "specs");
const shipped = readdirSync(specsDir).filter((d) => /^0(0\d|1[0-8])-/.test(d) && existsSync(join(specsDir, d, "tasks.md"))).sort();

const recorded = JSON.parse(readFileSync(join(root, "test", "fixtures", "unchanged-output-020.json"), "utf8")) as Record<
  string,
  { code: number; out: string }
>;

function shippedProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "ambykit-020-unchanged-"));
  mkdirSync(join(dir, ".amby"), { recursive: true });
  writeFileSync(join(dir, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  for (const d of readdirSync(specsDir).filter((n) => /^0(0\d|1[0-8])-/.test(n)).sort()) {
    cpSync(join(specsDir, d), join(dir, "specs", d), { recursive: true });
  }
  return dir;
}

type Cmd = { run(ctx: { cwd: string; positionals: string[]; flags: Record<string, string | boolean> }): Promise<number> };

async function run(cmd: Cmd, cwd: string, flags: Record<string, string | boolean>) {
  const lines: string[] = [];
  const orig = [console.log, console.warn, console.error];
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  console.warn = console.log;
  console.error = console.log;
  try {
    const code = await cmd.run({ cwd, positionals: [], flags });
    return { code, out: lines.join("\n") };
  } finally {
    [console.log, console.warn, console.error] = orig as [typeof console.log, typeof console.warn, typeof console.error];
  }
}

const withoutHeader = (out: string): string => out.split("\n").slice(1).join("\n");

describe("existing projects read exactly as before (spec 020, US-5)", () => {
  it("FR-012: no shipped tasks.md carries a BLOCKED marker, a DEVIATION note or a Verify line", () => {
    expect(shipped.length).toBeGreaterThan(10);
    for (const dir of shipped) {
      const content = readFileSync(join(specsDir, dir, "tasks.md"), "utf8");
      for (const t of parseTasks(content)) {
        expect(t.blocked, `${dir} ${t.id}`).toBeUndefined();
        expect(t.deviation, `${dir} ${t.id}`).toBeUndefined();
      }
      expect(parsePhases(content).filter((p) => p.check !== undefined), dir).toEqual([]);
    }
  });

  it("FR-011: analyze output on the shipped features equals the pre-020 output (text and --json)", async () => {
    const dir = shippedProject();
    const text = await run(new AnalyzeCommand() as Cmd, dir, {});
    expect(text.code).toBe(recorded["analyze-text"]?.code);
    expect(text.out).toBe(recorded["analyze-text"]?.out);
    const json = await run(new AnalyzeCommand() as Cmd, dir, { json: true });
    const now = JSON.parse(json.out) as Record<string, unknown>;
    delete now["verifyIssues"]; // the one allowed addition (missing-Verify warnings); none are raised for finished features
    expect(now).toEqual(JSON.parse(recorded["analyze-json"]?.out ?? "{}"));
    expect(json.code).toBe(recorded["analyze-json"]?.code);
  });

  it("FR-011: the shipped features raise no Verify finding at all (finished features that predate the convention stay quiet)", async () => {
    const json = await run(new AnalyzeCommand() as Cmd, shippedProject(), { json: true });
    expect(JSON.parse(json.out)).not.toHaveProperty("verifyIssues");
  });

  it("FR-011: the one-shot dashboard and its ascii layout are unchanged", async () => {
    const dir = shippedProject();
    const text = await run(new DashboardCommand() as Cmd, dir, {});
    expect(withoutHeader(text.out)).toBe(recorded["dashboard-text"]?.out);
    const ascii = await run(new DashboardCommand() as Cmd, dir, { icons: "ascii" });
    expect(withoutHeader(ascii.out)).toBe(recorded["dashboard-ascii"]?.out);
  });

  it("FR-011, FR-013: dashboard --json and --json --overview are unchanged, with no new key on any feature row", async () => {
    const dir = shippedProject();
    const bare = await run(new DashboardCommand() as Cmd, dir, { json: true });
    expect(JSON.parse(bare.out)).toEqual(JSON.parse(recorded["dashboard-json"]?.out ?? "[]"));
    const overview = await run(new DashboardCommand() as Cmd, dir, { json: true, overview: true });
    expect(JSON.parse(overview.out)).toEqual(JSON.parse(recorded["dashboard-overview"]?.out ?? "{}"));
  });
});
