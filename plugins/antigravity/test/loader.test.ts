import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TARGETS } from "../../../src/emitters/index.js";
import { loadPlugins } from "../../../src/plugins/loader.js";
import { buildRegistry } from "../../../src/plugins/registry.js";

/**
 * The package as a project installs it, through the real plugin loader (spec 036, FR-003, FR-007): its `package.json` is read from
 * `node_modules`, the pin and the API range are checked, the entry file must exist, and the factory is called with the running
 * AmbyKit's API. Only the last import is substituted: it returns the plugin's TypeScript source module, so the test needs no prior
 * build (CI runs the tests before `build:plugins`); the built output is checked by `npm run build:plugins` and `npm pack --dry-run`.
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NAME = "@ambystech/ambykit-emitter-antigravity";
const importSource = (): Promise<unknown> => import("../src/index.js");

function installed(): string {
  const root = join(mkdtempSync(join(tmpdir(), "ambykit-antigravity-")), "demo");
  const pkgDir = join(root, "node_modules", ...NAME.split("/"));
  mkdirSync(join(pkgDir, "dist"), { recursive: true });
  cpSync(join(dir, "package.json"), join(pkgDir, "package.json"));
  writeFileSync(join(pkgDir, "dist", "index.js"), "// stands in for the built entry; the test imports the source\n");
  return root;
}

describe("the package loads through the real loader (036:FR-003, FR-007)", () => {
  it("036:FR-007: it is accepted at the stable API with no notes, and provides both targets", async () => {
    const { loaded, failures } = await loadPlugins(installed(), { [NAME]: "1.0.0" }, { importModule: importSource });
    expect(failures).toEqual([]);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.name).toBe(NAME);
    expect(loaded[0]!.version).toBe("1.0.0");
    expect(loaded[0]!.notes).toBeUndefined();
    expect(loaded[0]!.targets.map((t) => t.id)).toEqual(["antigravity", "antigravity-cli"]);
  });

  it("036:FR-003: while core still bundles Antigravity (before the removal task T050) both ids are reported as collisions and the built-ins win", async () => {
    const { loaded } = await loadPlugins(installed(), { [NAME]: "1.0.0" }, { importModule: importSource });
    const registry = buildRegistry(TARGETS, loaded);
    expect(registry.collisions.map((c) => [c.id, c.with]).sort()).toEqual([
      ["antigravity", "built-in"],
      ["antigravity-cli", "built-in"],
    ]);
    expect(registry.targets.find((t) => t.id === "antigravity")).toBe(TARGETS.find((t) => t.id === "antigravity"));
  });

  it("036:FR-007: a pin that does not match the installed version is refused with the reason", async () => {
    const { loaded, failures } = await loadPlugins(installed(), { [NAME]: "1.0.1" }, { importModule: importSource });
    expect(loaded).toEqual([]);
    expect(failures.map((f) => f.reason).join("\n")).toMatch(/installed version 1\.0\.0 does not match the pin 1\.0\.1/);
  });
});
