import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RUNNERS, runnable } from "../src/core/runners.js";

const doc = readFileSync(resolve(__dirname, "..", "docs", "tool-compatibility.md"), "utf8");
const section = doc.slice(doc.indexOf("## Headless runners"), doc.indexOf("## To verify against a live install"));

interface Row {
  id: string;
  command: string;
  usage: string;
  status: string;
  version: string;
}

function rows(): Row[] {
  return section
    .split(/\r?\n/)
    .map((l) => /^\| `([a-z0-9-]+)` \| `([^`]+)` \| (.*?) \| (yes|no) \| (verified|unverified) \| (.*?) \|$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ id: m[1]!, command: m[2]!, usage: m[4]!, status: m[5]!, version: m[6]!.trim() }));
}

describe("headless runner doc-sync (feature 028)", () => {
  it("028:FR-007: the matrix has a section for headless runners", () => {
    expect(section.length).toBeGreaterThan(100);
    expect(section).toContain("experimental");
  });

  it("028:FR-007: the matrix and the registry list the same runners", () => {
    expect(rows().map((r) => r.id)).toEqual(RUNNERS.map((r) => r.id));
  });

  it("028:FR-007: each row's command, usage reporting and status equal the registry's", () => {
    for (const row of rows()) {
      const spec = RUNNERS.find((r) => r.id === row.id)!;
      const cmd = spec.invoke({ prompt: "x", promptFile: "f" });
      expect(row.command).toBe([cmd.exe, ...cmd.args].join(" "));
      expect(row.usage).toBe(spec.reportsUsage ? "yes" : "no");
      expect(row.status).toBe(spec.verified ? "verified" : "unverified");
      if (spec.verified) expect(row.version).toBe(spec.verifiedVersion);
      else expect(row.version).toMatch(/^—$/);
    }
  });

  it("028:SC-006: a row that says unverified is never runnable, and a verified row always records its version", () => {
    for (const row of rows()) {
      // A verified runner is runnable on the platforms its record lists (all of them when it lists none), so the check does not
      // depend on the operating system the suite runs on.
      const where = RUNNERS.find((r) => r.id === row.id)?.verifiedOn ?? (["linux", "darwin", "win32"] as NodeJS.Platform[]);
      for (const platform of ["linux", "darwin", "win32"] as const) {
        expect(runnable(row.id, { platform }).ok).toBe(row.status === "verified" && where.includes(platform));
      }
      if (row.status === "verified") expect(row.version).not.toBe("—");
    }
  });

  it("028:FR-007: the matrix says what is still to confirm on a live install", () => {
    expect(section).toContain("live install");
  });
});
