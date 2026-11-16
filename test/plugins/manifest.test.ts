import { describe, expect, it } from "vitest";
import { isPluginPackageName, readManifest } from "../../src/plugins/manifest.js";

describe("plugin manifest (feature 027)", () => {
  it("027:FR-006: names must be ambykit-emitter-*, scoped allowed", () => {
    for (const ok of ["ambykit-emitter-foo", "@acme/ambykit-emitter-foo", "ambykit-emitter-a-b"]) expect(isPluginPackageName(ok), ok).toBe(true);
    for (const bad of ["ambykit-foo", "foo", "ambykit-emitter-", "@acme/foo", "ambykit-emitter-../x", "Ambykit-emitter-x", "../ambykit-emitter-x"]) {
      expect(isPluginPackageName(bad), bad).toBe(false);
    }
  });

  it("027:FR-010: reads name, version, declared API range and entry", () => {
    const r = readManifest(JSON.stringify({ name: "ambykit-emitter-x", version: "1.2.3", main: "lib/i.js", ambykit: { pluginApi: "^1" } }));
    expect(r).toEqual({ ok: true, manifest: { name: "ambykit-emitter-x", version: "1.2.3", pluginApi: "^1", entry: "lib/i.js" } });
  });

  it("027:FR-010: entry prefers exports['.'], then main, then index.js", () => {
    const entry = (pkg: object) => {
      const r = readManifest(JSON.stringify({ name: "n", version: "1.0.0", ...pkg }));
      return r.ok ? r.manifest.entry : "bad";
    };
    expect(entry({ exports: "./a.js", main: "b.js" })).toBe("./a.js");
    expect(entry({ exports: { ".": { import: "./c.js" } } })).toBe("./c.js");
    expect(entry({ main: "b.js" })).toBe("b.js");
    expect(entry({})).toBe("index.js");
  });

  it("027:FR-010: a missing range is reported as null, not guessed", () => {
    const r = readManifest(JSON.stringify({ name: "n", version: "1.0.0" }));
    expect(r.ok && r.manifest.pluginApi).toBe(null);
  });

  it("027:FR-004: malformed package.json gives a reason", () => {
    expect(readManifest("{not json")).toEqual({ ok: false, reason: "package.json is not valid JSON" });
    expect(readManifest("[]")).toMatchObject({ ok: false });
    expect(readManifest(JSON.stringify({ version: "1.0.0" }))).toMatchObject({ ok: false, reason: "package.json has no name" });
    expect(readManifest(JSON.stringify({ name: "n" }))).toMatchObject({ ok: false, reason: "package.json has no version" });
  });
});
