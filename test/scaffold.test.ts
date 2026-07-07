import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  ARTIFACT_TEMPLATES,
  REFERENCE_DOCS,
  installArtifactTemplates,
} from "../src/core/scaffold.js";

const roots: string[] = [];
function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "ambykit-scaffold-"));
  roots.push(dir);
  return dir;
}

describe("installArtifactTemplates", () => {
  it("installs all artifact templates and reference docs", () => {
    const root = tempRoot();
    const result = installArtifactTemplates(root);
    for (const name of ARTIFACT_TEMPLATES) {
      expect(existsSync(join(root, ".amby", "templates", name))).toBe(true);
    }
    for (const name of REFERENCE_DOCS) {
      expect(existsSync(join(root, ".amby", "reference", name))).toBe(true);
    }
    expect(result.created.length).toBe(ARTIFACT_TEMPLATES.length + REFERENCE_DOCS.length);
    expect(result.present).toHaveLength(0);
  });

  it("never overwrites an existing (customized) template", () => {
    const root = tempRoot();
    const specPath = join(root, ".amby", "templates", "spec.md");
    mkdirSync(join(root, ".amby", "templates"), { recursive: true });
    writeFileSync(specPath, "MY CUSTOM SPEC", "utf8");

    const result = installArtifactTemplates(root);
    expect(readFileSync(specPath, "utf8")).toBe("MY CUSTOM SPEC");
    expect(result.present).toContain(".amby/templates/spec.md");
    expect(result.created).not.toContain(".amby/templates/spec.md");
  });

  it("dry-run writes nothing", () => {
    const root = tempRoot();
    const result = installArtifactTemplates(root, true);
    expect(existsSync(join(root, ".amby", "templates", "spec.md"))).toBe(false);
    expect(result.created.length).toBeGreaterThan(0);
  });
});

afterAll(() => {
  // temp dirs under the OS tmpdir; left for the OS to reap (rmSync avoided to keep the test simple)
  void roots;
});
