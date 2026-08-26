import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_WORD_LIMIT, loadRoles, parseRole, roleForSpec, validateRoles, wordCount } from "../../src/core/roles.js";
import { rolesDir } from "../../src/core/paths.js";
import { SHIPPED_ROLES, installArtifactTemplates } from "../../src/core/scaffold.js";

const role = (id: string, body: string, name = id) => `---\nid: ${id}\nname: ${name}\nphases: [plan]\n---\n${body}\n`;

describe("roles (feature 013)", () => {
  it("parses id/name/phases and counts body words", () => {
    const r = parseRole(role("qa", "one two three", "QA Engineer"), "qa.md");
    expect(r).toMatchObject({ id: "qa", name: "QA Engineer", phases: ["plan"], words: 3 });
    expect(wordCount("  a\nb   c ")).toBe(3);
  });

  it("rejects non-kebab ids", () => {
    expect(() => parseRole(role("QA Lead", "x"), "bad.md")).toThrow(/bad\.md/);
  });

  it("loads nothing when .amby/roles is absent (FR-004) and sorted roles when present", () => {
    const root = mkdtempSync(join(tmpdir(), "ambykit-roles-"));
    expect(loadRoles(root)).toEqual([]);
    mkdirSync(join(root, ".amby", "roles"), { recursive: true });
    writeFileSync(join(root, ".amby", "roles", "qa.md"), role("qa", "verify"));
    writeFileSync(join(root, ".amby", "roles", "pm.md"), role("pm", "own the what"));
    expect(loadRoles(root).map((r) => r.id)).toEqual(["pm", "qa"]);
  });

  it("refuses duplicate ids case-insensitively and warns above the word limit (FR-010)", () => {
    const long = Array.from({ length: ROLE_WORD_LIMIT + 1 }, (_, i) => `w${i}`).join(" ");
    const roles = [
      parseRole(role("qa", "short"), "qa.md"),
      parseRole(role("qa", "again"), "QA.md"),
      parseRole(role("pm", long), "pm.md"),
    ];
    const v = validateRoles(roles);
    expect(v.errors).toHaveLength(1);
    expect(v.errors[0]).toContain("qa");
    expect(v.warnings).toHaveLength(1);
    expect(v.warnings[0]).toContain(`${ROLE_WORD_LIMIT + 1} words`);
    const ok = validateRoles([parseRole(role("pm", Array(ROLE_WORD_LIMIT).fill("w").join(" ")), "pm.md")]);
    expect(ok.warnings).toEqual([]);
  });

  it("resolves a spec's role only when roles are installed and the id exists", () => {
    const roles = [parseRole(role("pm", "x"), "pm.md")];
    expect(roleForSpec(roles, "pm")?.id).toBe("pm");
    expect(roleForSpec(roles, "qa")).toBeUndefined();
    expect(roleForSpec([], "pm")).toBeUndefined();
    expect(roleForSpec(roles, undefined)).toBeUndefined();
  });

  it("ships six default roles, each within the word limit and mapped to phases (FR-002, SC-004)", () => {
    const files = readdirSync(rolesDir()).filter((f) => f.endsWith(".md")).sort();
    expect(files).toEqual([...SHIPPED_ROLES].sort());
    const roles = files.map((f) => parseRole(readFileSync(join(rolesDir(), f), "utf8"), f));
    expect(roles.map((r) => r.id).sort()).toEqual(["architect", "developer", "pm", "qa", "tech-lead", "ux"]);
    for (const r of roles) {
      expect(r.words, r.id).toBeLessThanOrEqual(ROLE_WORD_LIMIT);
      expect(r.phases.length, r.id).toBeGreaterThan(0);
    }
    expect(validateRoles(roles)).toEqual({ errors: [], warnings: [] });
  });

  it("installs roles into .amby/roles write-if-absent (FR-001)", () => {
    const root = mkdtempSync(join(tmpdir(), "ambykit-roles-install-"));
    mkdirSync(join(root, ".amby", "roles"), { recursive: true });
    writeFileSync(join(root, ".amby", "roles", "qa.md"), role("qa", "custom qa"));
    const result = installArtifactTemplates(root);
    expect(result.created).toContain(".amby/roles/pm.md");
    expect(result.present).toContain(".amby/roles/qa.md");
    expect(readFileSync(join(root, ".amby", "roles", "qa.md"), "utf8")).toContain("custom qa");
    expect(loadRoles(root)).toHaveLength(6);
  });
});
