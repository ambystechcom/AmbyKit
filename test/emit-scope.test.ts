import { describe, expect, it } from "vitest";
import { TARGETS } from "../src/emitters/index.js";
import { emitFiles } from "./helpers/emit-target.js";

/** Principle 7 / FR-008: no new target writes outside the repository. */

const NEW = ["gemini", "llxprt", "qwen", "kilo", "augment", "windsurf", "kiro", "pi"];

describe("emitted file scope (feature 016, FR-008)", () => {
  it.each(NEW)("%s: every file is project-scoped and relative", (id) => {
    for (const roles of [false, true]) {
      const files = emitFiles([id], { roles });
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        expect(f.scope, f.path).toBe("project");
        expect(f.path, f.path).not.toMatch(/^([/~]|[A-Za-z]:|\.\.)/);
        expect(f.path, f.path).not.toContain("..");
      }
    }
  });

  it("no target at all emits a user-scoped file by default", () => {
    for (const t of TARGETS) {
      const user = emitFiles([t.id]).filter((f) => f.scope !== "project");
      expect(user.map((f) => f.path), t.id).toEqual([]);
    }
  });

  it("does not write tool settings files (Principle 7)", () => {
    const paths = emitFiles(NEW).map((f) => f.path);
    expect(paths.filter((p) => /settings\.json$|config\.(json|toml)$/.test(p))).toEqual([]);
  });
});
