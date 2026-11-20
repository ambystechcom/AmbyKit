import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOSS_NOTICE, MigrateCommand } from "../../src/cli/migrate.js";
import { runCommand } from "../helpers/run-command.js";
import { tempProject } from "../helpers/spec-project.js";

const OLD = {
  "spec.md": "---\nfeature: 901-old\n---\n\n### US-1 — Old\n\n- **status:** done\n",
  "tasks.md": "## Phase 1\n\n- [x] [T001] [US1] a (src/a.ts)\n",
};
const doc = (rel: string): string => readFileSync(join(import.meta.dirname, "..", "..", rel), "utf8").replace(/\s+/g, " ");

describe("the 1.x data-loss notice (030, FR-025, 026:R-1)", () => {
  it("030:FR-025: migrate output says a 1.x tool reads a v2 file without an error but loses statuses, dependencies, ownership and Verify results", async () => {
    const r = await runCommand(new MigrateCommand(), tempProject({ "901-old": OLD }), [], {});
    expect(r.out).toContain(LOSS_NOTICE);
    expect(LOSS_NOTICE).toMatch(/1\.x AmbyKit reads a v2 file without an error but loses story statuses, dependencies, file ownership and Verify results/);
    expect(LOSS_NOTICE).toMatch(/Upgrade every tool.*before you commit/);
    expect(LOSS_NOTICE).toMatch(/--dual-write/);
  });

  it("030:FR-025: a dry run prints the notice too, since it is what a person reads before deciding", async () => {
    const r = await runCommand(new MigrateCommand(), tempProject({ "901-old": OLD }), [], { "dry-run": true });
    expect(r.out).toContain(LOSS_NOTICE);
  });

  it("030:FR-025: nothing to convert, nothing to warn about", async () => {
    const dir = tempProject({ "901-old": OLD });
    await runCommand(new MigrateCommand(), dir, [], {});
    const again = await runCommand(new MigrateCommand(), dir, [], {});
    expect(again.out).not.toContain(LOSS_NOTICE);
  });

  it("030:FR-025: the migration guide states it, and so does the CLI reference", () => {
    for (const rel of ["docs/migration.md", "docs/cli-reference.md"]) {
      const text = doc(rel);
      expect(text, rel).toMatch(/1\.x AmbyKit reads a v2 file \*?\*?without an error\*?\*? but loses story statuses, dependencies, file ownership and Verify results/);
    }
  });
});
