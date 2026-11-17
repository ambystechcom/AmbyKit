import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_WORD_LIMIT, loadRoles, parseRole, validateRoles } from "../src/core/roles.js";
import { SHIPPED_ROLES, installArtifactTemplates } from "../src/core/scaffold.js";

// Feature 022 US-6: a shipped, read-only security reviewer for `/amby.review --as security`.
describe("security role (feature 022)", () => {
  const raw = readFileSync(join(import.meta.dirname, "..", "src", "roles", "security.md"), "utf8");

  it("parses and stays within the word limit (FR-014)", () => {
    const role = parseRole(raw, "security.md");
    expect(role.id).toBe("security");
    expect(role.words).toBeLessThanOrEqual(ROLE_WORD_LIMIT);
  });

  it("is read-only and advisory, and never creates a record", () => {
    const role = parseRole(raw, "security.md");
    expect(role.body).toMatch(/read-only/i);
    expect(role.body).toMatch(/never edit/i);
    expect(role.body).toMatch(/never create a decision record/i);
  });

  it("is registered and installed by scaffold, alongside the other roles", () => {
    expect(SHIPPED_ROLES).toContain("security.md");
    const root = mkdtempSync(join(tmpdir(), "ambykit-security-"));
    const result = installArtifactTemplates(root);
    expect(result.created).toContain(".amby/roles/security.md");
    const roles = loadRoles(root);
    expect(roles.map((r) => r.id)).toContain("security");
    expect(validateRoles(roles)).toEqual({ errors: [], warnings: [] });
  });
});
