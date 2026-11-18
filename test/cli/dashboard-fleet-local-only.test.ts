import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * FR-014: the Fleet view paths run entirely locally at zero model tokens, with no network service. A static
 * guard over the modules 029 adds: none imports a network or process-spawning module, and none calls `fetch`.
 */

const ROOT = join(__dirname, "..", "..");
const FILES = [
  ...readdirSync(join(ROOT, "src", "core", "fleet-view")).map((f) => join("src", "core", "fleet-view", f)),
  join("src", "cli", "ui", "interactive", "fleet.ts"),
  join("src", "cli", "ui", "interactive", "fleet-actions.ts"),
  join("src", "cli", "ui", "icons.ts"),
];

const FORBIDDEN = [
  "node:http",
  "node:https",
  "node:http2",
  "node:net",
  "node:dgram",
  "node:dns",
  "node:tls",
  "node:child_process",
  "node:worker_threads",
  "node:cluster",
];

describe("fleet paths are local only (feature 029, FR-014)", () => {
  it.each(FILES)("029:FR-014: %s imports no network or process module and never calls fetch", (file) => {
    const src = readFileSync(join(ROOT, file), "utf8");
    for (const mod of FORBIDDEN) expect(src).not.toContain(`"${mod}"`);
    expect(/\bfetch\s*\(/.test(src)).toBe(false);
    expect(/\bimport\s*\(\s*["'](?!\.)/.test(src)).toBe(false);
  });

  it("029:FR-014: the guard covers the view-model, reducer, actions and icon modules", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(7);
  });
});
