import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { nodeProcessPort, resolveExecutable, windowsCommand } from "../../src/cli/run-process.js";

const FAKE = resolve(__dirname, "..", "fixtures", "fake-runner.mjs");
const plan = (p: object): Record<string, string> => ({ FAKE_RUNNER: JSON.stringify(p) });

describe("process edge (feature 028)", () => {
  it("028:FR-004: spawns in the given directory, delivers the prompt on stdin and reports the exit code", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-proc-"));
    const record = join(dir, "record.jsonl");
    const h = nodeProcessPort.spawn({ exe: process.execPath, args: [FAKE], cwd: dir, env: plan({ record, exit: 3 }), stdin: "build T001" });
    const exit = await h.exited;
    expect(exit.code).toBe(3);
    expect(h.alive()).toBe(false);
    const rec = JSON.parse(readFileSync(record, "utf8").trim());
    expect(rec.prompt).toBe("build T001");
    expect(rec.cwd.toLowerCase()).toBe(dir.toLowerCase());
  });

  it("028:FR-008: a hung process is alive until it is killed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-proc-"));
    const record = join(dir, "record.jsonl");
    const h = nodeProcessPort.spawn({ exe: process.execPath, args: [FAKE], cwd: dir, env: plan({ record, hang: true }), stdin: "x" });
    for (let i = 0; i < 100 && !existsSync(record); i++) await new Promise((r) => setTimeout(r, 50));
    expect(h.alive()).toBe(true);
    expect(h.pid).toBeGreaterThan(0);
    expect(nodeProcessPort.isAlive(h.pid!)).toBe(true);
    h.kill("SIGKILL");
    await h.exited;
    expect(h.alive()).toBe(false);
  });

  it("028:FR-008: a missing executable reports a failed exit instead of throwing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-proc-"));
    const h = nodeProcessPort.spawn({ exe: "definitely-not-an-assistant-xyz", args: [], cwd: dir });
    expect((await h.exited).code).not.toBe(0);
  });

  it("028:FR-004: on Windows a .cmd shim on PATH is resolved through PATHEXT", () => {
    const hits = new Set(["C:\\bin\\claude.CMD"]);
    const got = resolveExecutable("claude", { PATH: "C:\\other;C:\\bin", PATHEXT: ".EXE;.CMD" }, "win32", (p) => hits.has(p));
    expect(got).toBe("C:\\bin\\claude.CMD");
  });

  it("028:FR-004: off Windows the executable name is used as is", () => {
    expect(resolveExecutable("claude", { PATH: "/bin" }, "linux", () => true)).toBe("claude");
  });

  it("028:FR-004: a .cmd shim runs through cmd.exe with quoted arguments; an .exe spawns directly", () => {
    const shim = windowsCommand("C:\\bin\\claude.CMD", ["-p", "two words"]);
    expect(shim.exe).toBe("cmd.exe");
    expect(shim.verbatim).toBe(true);
    expect(shim.args.join(" ")).toContain('"two words"');
    expect(windowsCommand("C:\\bin\\codex.exe", ["exec"])).toEqual({ exe: "C:\\bin\\codex.exe", args: ["exec"], verbatim: false });
  });
});
