import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
/** The version in the package itself, so a release bump needs no test edit. */
const VERSION = (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { version: string }).version;
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
    const { loaded, failures } = await loadPlugins(installed(), { [NAME]: VERSION }, { importModule: importSource });
    expect(failures).toEqual([]);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.name).toBe(NAME);
    expect(loaded[0]!.version).toBe(VERSION);
    expect(loaded[0]!.notes).toBeUndefined();
    expect(loaded[0]!.targets.map((t) => t.id)).toEqual(["antigravity", "antigravity-cli"]);
  });

  it("036:FR-003: with the built-ins removed from core the two ids are provided by the plugin alone, with no collision", async () => {
    const { loaded } = await loadPlugins(installed(), { [NAME]: VERSION }, { importModule: importSource });
    const registry = buildRegistry(TARGETS, loaded);
    expect(registry.collisions).toEqual([]);
    expect(registry.owners.get("antigravity")).toBe(NAME);
    expect(registry.owners.get("antigravity-cli")).toBe(NAME);
  });

  it("036:FR-007: a pin that does not match the installed version is refused with the reason", async () => {
    const { loaded, failures } = await loadPlugins(installed(), { [NAME]: "0.0.1" }, { importModule: importSource });
    expect(loaded).toEqual([]);
    expect(failures.map((f) => f.reason).join("\n")).toContain(`installed version ${VERSION} does not match the pin 0.0.1`);
  });
});
