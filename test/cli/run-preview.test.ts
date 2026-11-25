import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RunCommand } from "../../src/cli/run.js";
import { listRuns } from "../../src/core/fleet/index.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { FakePort, fakeRegistry, preparedProject, unverifiedRegistry } from "../helpers/run-fakes.js";
import { runCommand } from "../helpers/run-command.js";

const F = "028-ambykit-run";

class Spy extends RunCommand {
  launched = 0;
  protected override async launch(): Promise<number> {
    this.launched += 1;
    return 0;
  }
}

function setup() {
  const port = new FakePort();
  const cmd = new Spy({ registry: fakeRegistry(), port });
  return { port, cmd };
}

describe.skipIf(!HAS_GIT)("ambykit run preview, --yes and --emit-script (feature 028)", () => {
  it("028:FR-001: without --yes it prints the exact command for each lane and launches nothing", async () => {
    const p = await preparedProject(F);
    const { port, cmd } = setup();
    const r = await runCommand(cmd, p.root, [F]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("Run plan for 028-ambykit-run");
    expect(r.out).toContain("lane-1-1");
    expect(r.out).toContain("lane-1-2");
    expect(r.out.match(/cd .*&&/g)).toHaveLength(2);
    expect(r.out).toContain("Nothing launched");
    expect(cmd.launched).toBe(0);
    expect(port.starts).toHaveLength(0);
    expect(listRuns(p.root, F)).toEqual([]);
  });

  it("028:SC-002: nothing is launched without --yes and launching happens with it, after the commands are printed", async () => {
    const p = await preparedProject(F);
    const { cmd } = setup();
    await runCommand(cmd, p.root, [F]);
    expect(cmd.launched).toBe(0);
    const r = await runCommand(cmd, p.root, [F], { yes: true });
    expect(r.out).toContain("cd ");
    expect(cmd.launched).toBe(1);
  });

  it("028:FR-002: --yes prints before it launches", async () => {
    const p = await preparedProject(F);
    const order: string[] = [];
    class Ordered extends RunCommand {
      protected override async launch(): Promise<number> {
        order.push("launch");
        return 0;
      }
    }
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => void (logs.push(a.join(" ")), order.push("print"));
    try {
      await new Ordered({ registry: fakeRegistry(), port: new FakePort() }).run({ cwd: p.root, positionals: [F], flags: { yes: true } });
    } finally {
      console.log = orig;
    }
    expect(order.indexOf("print")).toBeLessThan(order.indexOf("launch"));
    expect(order.at(-1)).toBe("launch");
  });

  it("028:FR-003: --emit-script writes launch.sh and launch.ps1 and launches nothing", async () => {
    const p = await preparedProject(F);
    const { cmd, port } = setup();
    const r = await runCommand(cmd, p.root, [F], { "emit-script": true, yes: true });
    expect(r.code).toBe(0);
    const dir = join(p.root, ".amby", "fleet", `${F}.scripts`);
    expect(existsSync(join(dir, "launch.sh"))).toBe(true);
    expect(existsSync(join(dir, "launch.ps1"))).toBe(true);
    expect(readFileSync(join(dir, "launch.sh"), "utf8").match(/&\s*$/gm)).toHaveLength(2);
    expect(cmd.launched).toBe(0);
    expect(port.starts).toHaveLength(0);
  });

  it("028:FR-006: --yes with an unverified assistant is refused with the reason and launches nothing", async () => {
    const p = await preparedProject(F);
    const cmd = new Spy({ registry: unverifiedRegistry(), port: new FakePort() });
    const r = await runCommand(cmd, p.root, [F], { yes: true });
    expect(r.code).toBe(1);
    expect(r.err).toContain("not verified");
    expect(cmd.launched).toBe(0);
  });

  it("028:FR-006: the preview of an unverified assistant shows the refusal and still exits 0", async () => {
    const p = await preparedProject(F);
    const r = await runCommand(new Spy({ registry: unverifiedRegistry(), port: new FakePort() }), p.root, [F]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("REFUSED");
  });

  it("028:FR-006: --emit-script refuses too, so no script ever names an unverified runner", async () => {
    const p = await preparedProject(F);
    const r = await runCommand(new Spy({ registry: unverifiedRegistry(), port: new FakePort() }), p.root, [F], { "emit-script": true });
    expect(r.code).toBe(1);
    expect(existsSync(join(p.root, ".amby", "fleet", `${F}.scripts`, "launch.sh"))).toBe(false);
  });

  it("028:FR-004: two lanes go to two different assistants, each in its own worktree", async () => {
    const p = await preparedProject(F);
    const r = await runCommand(setup().cmd, p.root, [F], { json: true });
    const plan = JSON.parse(r.out);
    expect(plan.lanes.map((l: { assistant: string }) => l.assistant)).toEqual(["claude", "claude"]);
    const r2 = await runCommand(setup().cmd, p.root, [F], { json: true, assistant: "claude,codex" });
    const plan2 = JSON.parse(r2.out);
    expect(plan2.lanes.map((l: { assistant: string }) => l.assistant)).toEqual(["claude", "codex"]);
    expect(new Set(plan2.lanes.map((l: { cwd: string }) => l.cwd)).size).toBe(2);
    expect(plan2.experimental).toBe(true);
    expect(plan2.launched).toBe(false);
  });

  it("028:FR-015: unattended mode is shown at the start, and attended mode says it waits for approval", async () => {
    const p = await preparedProject(F);
    const a = await runCommand(setup().cmd, p.root, [F]);
    expect(a.out).toContain("attended");
    const u = await runCommand(setup().cmd, p.root, [F], { unattended: true });
    expect(u.out).toContain("UNATTENDED");
  });

  it("028:FR-013: the resolved caps and budgets are shown at the start", async () => {
    const p = await preparedProject(F);
    const r = await runCommand(setup().cmd, p.root, [F], { "max-minutes": "30", "max-tokens": "5000" });
    expect(r.out).toContain("3 at once, 2 per assistant");
    expect(r.out).toContain("30 minutes");
    expect(r.out).toContain("5000 tokens");
  });
});
