import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../src/core/analyze.js";
import { analyzeSlice, laneTasks, nextTask, storyStatus } from "../src/core/query.js";

/** 030:FR-018 — the MCP read tools answer the same on a 1.x project and its hand-made v2 twin. */
const TWINS = join(import.meta.dirname, "fixtures", "spec-format-twins");

function twin(kind: "v1" | "v2"): string {
  const dir = mkdtempSync(join(tmpdir(), `ambykit-030-twin-${kind}-`));
  mkdirSync(join(dir, ".amby"), { recursive: true });
  writeFileSync(join(dir, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  cpSync(join(TWINS, kind, "specs"), join(dir, "specs"), { recursive: true });
  return dir;
}

const v1 = twin("v1");
const v2 = twin("v2");

/** Task descriptions in 1.x still carry the ownership group (the v2 reader never has one); compare without it. */
const noGroup = (x: unknown): unknown => JSON.parse(JSON.stringify(x).replace(/\s*\\?\([^()"]*\)(?=")/g, ""));

describe("MCP read tools: 1.x and v2 twins agree (030, FR-018)", () => {
  it("030:FR-018: next_task gives the same answer", () => {
    const a = nextTask(v1, "001");
    const b = nextTask(v2, "001");
    expect(noGroup(b)).toEqual(noGroup(a));
    expect(JSON.stringify(a)).toMatch(/T010|T011|T020/);
  });

  it("030:FR-018: story_status gives the same answer for every story", () => {
    for (const s of ["US-1", "US-2", "US-3", "US-4"]) {
      expect(storyStatus(v2, "001", s), s).toEqual(storyStatus(v1, "001", s));
    }
    expect(storyStatus(v2, "001", "US-2")).toMatchObject({ status: "in-progress" });
  });

  it("030:FR-018: lane_tasks gives the same answer", () => {
    expect(noGroup(laneTasks(v2, "001"))).toEqual(noGroup(laneTasks(v1, "001")));
  });

  it("030:FR-018: analyze_report gives the same answer", () => {
    expect(analyzeSlice(v2, "001")).toEqual(analyzeSlice(v1, "001"));
    expect(analyzeSlice(v2)).toEqual(analyzeSlice(v1));
  });

  it("030:FR-018: the full analyze report is the same on the twins (the v2 twin has no format error)", () => {
    const a = analyzeProject(v1);
    const b = analyzeProject(v2);
    expect(b.formatIssues?.filter((i) => i.severity === "error") ?? []).toEqual([]);
    const { formatIssues: _ignored, ...rest } = b;
    void _ignored;
    expect(noGroup(rest)).toEqual(noGroup(a));
  });
});
