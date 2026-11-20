import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 030:FR-015 — the bin entry checks the Node version before the CLI's module graph loads. The CLI proper (`main.ts`) is
 * replaced by a spy, so the test can see whether the launcher ever imported it.
 */
const spy = vi.hoisted(() => ({ loaded: 0, calls: [] as string[][] }));
vi.mock("../../src/cli/main.js", () => {
  spy.loaded += 1;
  return {
    main: async (argv: string[]) => {
      spy.calls.push(argv);
      return 0;
    },
  };
});

const entry = join(import.meta.dirname, "..", "..", "src", "cli", "index.ts");
const realArgv = [...process.argv];
const realNode = process.versions.node;

function fakeNode(version: string): void {
  Object.defineProperty(process.versions, "node", { value: version, configurable: true });
}

afterEach(() => {
  process.argv = [...realArgv];
  fakeNode(realNode);
  process.exitCode = undefined;
  spy.loaded = 0;
  spy.calls.length = 0;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("bin launcher (030, US-8)", () => {
  it("030:FR-015: on Node below 22 it prints the required-version message, exits 1, and never loads the CLI", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakeNode("20.11.1");
    process.argv = [realArgv[0] ?? "node", entry, "--version"];
    vi.resetModules();
    await import("../../src/cli/index.js");
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0]?.[0])).toMatch(/Node\.js 22 or newer \(found 20\.11\.1\)/);
    expect(process.exitCode).toBe(1);
    expect(spy.loaded).toBe(0);
  });

  it("030:FR-015: on Node 22 or newer it loads the CLI and hands it the arguments", async () => {
    process.argv = [realArgv[0] ?? "node", entry, "migrate", "--dry-run"];
    vi.resetModules();
    await import("../../src/cli/index.js");
    await vi.waitFor(() => expect(spy.calls).toEqual([["migrate", "--dry-run"]]));
    expect(spy.loaded).toBe(1);
    expect(process.exitCode).toBe(0);
  });

  it("030:FR-015: importing the module as a library (not the entry point) neither checks nor runs anything", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakeNode("18.0.0");
    process.argv = [realArgv[0] ?? "node", "/somewhere/else.js"];
    vi.resetModules();
    const mod = await import("../../src/cli/index.js");
    expect(err).not.toHaveBeenCalled();
    expect(spy.loaded).toBe(0);
    expect(typeof mod.main).toBe("function");
  });

  it("030:FR-015: the exported main is a lazy wrapper that loads the CLI only when called", async () => {
    vi.resetModules();
    const mod = await import("../../src/cli/index.js");
    expect(spy.calls).toEqual([]);
    expect(await mod.main(["graph"])).toBe(0);
    expect(spy.calls).toEqual([["graph"]]);
  });
});
