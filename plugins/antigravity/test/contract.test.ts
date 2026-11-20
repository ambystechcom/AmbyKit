import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertEmitterContract, checkEmitterContract, createPluginApi, type MatrixRow } from "@ambystech/ambykit/testkit";
import factory from "../src/index.js";

/**
 * The contract kit against Antigravity's documented layout (spec 036, FR-007). The rows in `matrix-rows.json` are recorded from
 * the host's own documentation (https://antigravity.google/docs/skills, also summarized in docs/tool-compatibility.md):
 * skills at `.agents/skills/<name>/SKILL.md` with `name` and `description` frontmatter (Principle 4).
 */

const rows: MatrixRow[] = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "matrix-rows.json"), "utf8"));
const targets = factory(createPluginApi()).targets;
const rowFor = (id: string): MatrixRow => rows.find((r) => r.target === id)!;

describe("the Antigravity plugin passes the contract kit (036:FR-007)", () => {
  it("036:FR-007: it provides exactly the two Antigravity targets, each with a recorded matrix row", () => {
    expect(targets.map((t) => t.id)).toEqual(["antigravity", "antigravity-cli"]);
    expect(rows.map((r) => r.target)).toEqual(["antigravity", "antigravity-cli"]);
    for (const r of rows) expect(r.sourceUrl).toMatch(/^https:\/\/antigravity\.google\/docs\//);
  });

  for (const target of targets) {
    it(`036:FR-007: ${target.id} emits what its row documents`, () => {
      expect(checkEmitterContract(target, rowFor(target.id))).toEqual([]);
      expect(() => assertEmitterContract(target, rowFor(target.id))).not.toThrow();
    });
  }

  it("036:FR-007: the kit is not vacuous: a wrong row fails, a missing row fails", () => {
    const [ide] = targets;
    expect(checkEmitterContract(ide!, { ...rowFor("antigravity"), frontmatterKeys: ["name", "description", "tools"] }).map((f) => f.kind)).toContain("frontmatter");
    expect(checkEmitterContract(ide!, { ...rowFor("antigravity"), commandDir: ".agents/workflows" }).map((f) => f.kind)).toContain("dir");
    expect(checkEmitterContract(ide!, undefined)[0]!.kind).toBe("missing-row");
  });
});
