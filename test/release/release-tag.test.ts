import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without type declarations
import { PRERELEASE_TAG, distTag, parseVersion } from "../../scripts/release-tag.mjs";

/** 034:FR-009 — a release candidate goes to a non-`latest` dist-tag; a plain version goes to `latest`. */
const root = resolve(__dirname, "..", "..");

describe("release-tag (034, US-6)", () => {
  it("034:FR-009: a prerelease publishes under next, never latest (decision D-3)", () => {
    expect(PRERELEASE_TAG).toBe("next");
    for (const v of ["2.0.0-rc.1", "2.0.0-rc.2", "2.0.0-beta.0", "2.1.0-alpha"]) expect(distTag(v)).toEqual({ ok: true, tag: "next" });
  });

  it("034:FR-009: a plain version publishes under latest", () => {
    for (const v of ["2.0.0", "2.0.1", "1.6.0"]) expect(distTag(v)).toEqual({ ok: true, tag: "latest" });
  });

  it("034:FR-009: a malformed version is refused with a reason", () => {
    for (const v of ["2.0", "v2.0.0", "2.0.0-", "2.0.0+build.1", "02.0.0", "", "latest"]) {
      const r = distTag(v);
      expect(r.ok, v).toBe(false);
      expect(r.reason).toContain(v);
    }
    expect(parseVersion("2.0.0-rc.1")).toEqual({ major: 2, minor: 0, patch: 0, prerelease: "rc.1" });
  });

  it("034:FR-009: the command prints the tag for a version and fails on a malformed one", () => {
    const run = (v: string) => spawnSync(process.execPath, [resolve(root, "scripts/release-tag.mjs"), v], { encoding: "utf8" });
    const rc = run("2.0.0-rc.1");
    expect(rc.status).toBe(0);
    expect(rc.stdout.trim()).toBe("next");
    const bad = run("2.0");
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain("::error::");
  });
});
