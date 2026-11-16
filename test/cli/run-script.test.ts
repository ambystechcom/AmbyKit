import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { emitScripts, powershellScript, shellScript } from "../../src/cli/run-script.js";
import { launchPlan } from "../../src/core/run-launch-plan.js";
import { listRuns } from "../../src/core/fleet/index.js";
import { gitProject } from "../helpers/git-repo.js";
import { fakeRegistry } from "../helpers/run-fakes.js";

const F = "028-ambykit-run";
const lanes = [1, 2, 3].map((n) => ({ lane: `lane-1-${n}`, full: `${F}.lane-1-${n}`, cwd: `/w/${n}`, assistant: n === 2 ? "codex" : "claude", prompt: `p${n}` }));
const plan = () => launchPlan(lanes, { promptFileFor: (l) => `/p/${l}.md`, registry: fakeRegistry() });

describe("emitted launch scripts (feature 028)", () => {
  it("028:FR-003: the shell script has one command per lane, batched by the cap", () => {
    const text = shellScript(F, plan(), 2);
    expect(text.startsWith("#!/bin/sh")).toBe(true);
    expect(text.match(/&\s*$/gm)).toHaveLength(3);
    expect(text.match(/^wait$/gm)).toHaveLength(2);
    expect(text).toContain("cd '/w/1'");
    expect(text).toContain("< '/p/lane-1-1.md'");
    expect(text).toContain("nothing has been launched");
  });

  it("028:FR-003: the PowerShell script starts each lane in its folder, reading its prompt, and waits per batch", () => {
    const text = powershellScript(F, plan(), 2);
    expect(text.match(/Start-Process/g)).toHaveLength(3);
    expect(text).toContain("-WorkingDirectory '/w/2'");
    expect(text).toContain("-RedirectStandardInput '/p/lane-1-2.md'");
    expect(text.match(/Wait-Process/g)).toHaveLength(2);
    expect(text).toContain("\r\n");
  });

  it("028:FR-003: a refused lane is left out of the script", () => {
    const p = launchPlan(lanes, { promptFileFor: (l) => `/p/${l}.md`, registry: fakeRegistry(["claude"]) });
    expect(shellScript(F, p, 3).match(/&\s*$/gm)).toHaveLength(2);
  });

  it("028:FR-003: apostrophes in a path are escaped for the shell", () => {
    const p = launchPlan([{ ...lanes[0]!, cwd: "/w/it's" }], { promptFileFor: (l) => `/p/${l}.md`, registry: fakeRegistry() });
    expect(shellScript(F, p, 3)).toContain("'/w/it'\\''s'");
  });

  it("028:FR-020: writing the scripts stays inside the project's fleet directory and creates no run", () => {
    const root = gitProject([F]);
    const out = emitScripts(root, F, plan(), 3);
    expect(existsSync(out.sh)).toBe(true);
    expect(existsSync(out.ps1)).toBe(true);
    expect(out.prompts).toHaveLength(3);
    expect(out.sh.startsWith(join(root, ".amby", "fleet"))).toBe(true);
    expect(basename(out.dir)).toBe(`${F}.scripts`);
    expect(readFileSync(out.prompts[0]!, "utf8")).toBe("p1\n");
    expect(readFileSync(out.sh, "utf8")).toContain("prompts");
    expect(listRuns(root, F)).toEqual([]);
    expect(readFileSync(join(root, ".amby", "fleet", ".gitignore"), "utf8")).toContain("*");
  });
});
