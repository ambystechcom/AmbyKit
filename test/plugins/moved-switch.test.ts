import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEPRECATED_TARGETS,
  MOVED_TARGETS,
  PLANNED_DEPRECATED_TARGETS,
  PLANNED_MOVED_TARGETS,
  SPLIT_ACTIVE,
  deprecatedTargetNotices,
  movedTargetChoices,
  movedTargetRefusals,
  targetStatus,
} from "../../src/core/moved-targets.js";
import { TARGETS } from "../../src/emitters/index.js";
import { createPluginApi } from "../../src/plugins/api.js";
import factory from "../../plugins/antigravity/src/index.js";

/**
 * Feature 036, T040: the planned split as data, and the single switch that turns it on (FR-001, FR-002). While core still bundles
 * the Antigravity emitters the switch is off and nothing a user sees changes; task T050 removes the emitters and flips it.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pluginPackage = JSON.parse(readFileSync(join(ROOT, "plugins", "antigravity", "package.json"), "utf8")) as { name: string; version: string };

describe("the split switch (036:FR-001, FR-002)", () => {
  it("036:FR-002: it is off while core still bundles the Antigravity emitters, so nothing has moved yet (T050 flips it)", () => {
    expect(SPLIT_ACTIVE).toBe(false);
    expect(MOVED_TARGETS).toEqual({});
    expect(DEPRECATED_TARGETS).toEqual({});
    expect(TARGETS.map((t) => t.id)).toContain("antigravity");
    expect(TARGETS.map((t) => t.id)).toContain("antigravity-cli");
  });

  it("036:FR-002: with the switch off every bundled target is built in and the commands have nothing to say", () => {
    for (const t of TARGETS) expect(targetStatus(t.id), t.id).toEqual({ state: "built-in" });
    expect(movedTargetRefusals(["antigravity", "gemini", "claude"], () => true)).toEqual([]);
    expect(movedTargetChoices(() => false)).toEqual([]);
    expect(deprecatedTargetNotices(["gemini", "kiro"])).toEqual([]);
  });
});

describe("the planned split (036:FR-002)", () => {
  it("036:FR-002: both Antigravity harnesses move to one official package, since 2.0.0", () => {
    expect(Object.keys(PLANNED_MOVED_TARGETS).sort()).toEqual(["antigravity", "antigravity-cli"]);
    for (const m of Object.values(PLANNED_MOVED_TARGETS)) {
      expect(m.package).toBe("@ambystech/ambykit-emitter-antigravity");
      expect(m.since).toBe("2.0.0");
    }
  });

  it("036:FR-002: the planned package is exactly what plugins/antigravity publishes, and it provides exactly the planned ids", () => {
    for (const m of Object.values(PLANNED_MOVED_TARGETS)) expect(m.package).toBe(pluginPackage.name);
    const provided = factory(createPluginApi()).targets.map((t) => t.id).sort();
    expect(provided).toEqual(Object.keys(PLANNED_MOVED_TARGETS).sort());
  });

  it("036:FR-002: the seven long-tail targets are announced as moving to a package each; none gates 2.0", () => {
    expect(Object.keys(PLANNED_DEPRECATED_TARGETS).sort()).toEqual(["augment", "gemini", "kilo", "kiro", "llxprt", "qwen", "windsurf"]);
    for (const [id, d] of Object.entries(PLANNED_DEPRECATED_TARGETS)) expect(d.package).toBe(`@ambystech/ambykit-emitter-${id}`);
    // They are bundled targets today, which is why they are deprecated and not moved.
    for (const id of Object.keys(PLANNED_DEPRECATED_TARGETS)) expect(TARGETS.some((t) => t.id === id), id).toBe(true);
  });

  it("036:FR-001, FR-002: described as the 2.0 registry (built-ins minus Antigravity), the statuses are the planned ones", () => {
    const bundled = TARGETS.map((t) => t.id).filter((id) => !(id in PLANNED_MOVED_TARGETS));
    const sources = { bundled, moved: PLANNED_MOVED_TARGETS, deprecated: PLANNED_DEPRECATED_TARGETS };
    expect(targetStatus("antigravity", sources)).toEqual({ state: "moved", package: "@ambystech/ambykit-emitter-antigravity", since: "2.0.0" });
    expect(targetStatus("antigravity-cli", sources).state).toBe("moved");
    expect(targetStatus("gemini", sources)).toEqual({ state: "deprecated", package: "@ambystech/ambykit-emitter-gemini" });
    for (const id of ["claude", "claude-vscode", "codex", "pi", "copilot", "copilot-cli", "cursor", "cursor-cli", "opencode"]) {
      expect(targetStatus(id, sources), id).toEqual({ state: "built-in" });
    }
    expect(targetStatus("nope", sources)).toEqual({ state: "unknown" });
  });

  it("036:FR-001: the built-in set after the split is the five products and their variants (the owner's decision)", () => {
    const after = TARGETS.map((t) => t.id).filter((id) => !(id in PLANNED_MOVED_TARGETS));
    expect(after.filter((id) => !(id in PLANNED_DEPRECATED_TARGETS)).sort()).toEqual(
      ["claude", "claude-vscode", "codex", "copilot", "copilot-cli", "cursor", "cursor-cli", "opencode", "pi"].sort(),
    );
  });
});
