import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyProject, describeSignals } from "../../src/core/classify.js";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "ambykit-classify-"));
}

describe("classifyProject (US-3 / FR-008, FR-009)", () => {
  it("classifies an empty directory as greenfield", () => {
    const c = classifyProject(tempRoot());
    expect(c.mode).toBe("greenfield");
    expect(c.signals).toEqual({ rulesFile: false, sourceFiles: false, gitHistory: false });
  });

  it("treats an AmbyKit-only scaffold (just .amby/) as greenfield", () => {
    const root = tempRoot();
    mkdirSync(join(root, ".amby"), { recursive: true });
    writeFileSync(join(root, ".amby", "config.json"), "{}", "utf8");
    expect(classifyProject(root).mode).toBe("greenfield");
  });

  it("detects an existing rules file as brownfield", () => {
    const root = tempRoot();
    writeFileSync(join(root, "CLAUDE.md"), "my rules\n", "utf8");
    const c = classifyProject(root);
    expect(c.mode).toBe("brownfield");
    expect(c.signals.rulesFile).toBe(true);
  });

  it("detects non-AmbyKit source files as brownfield", () => {
    const root = tempRoot();
    writeFileSync(join(root, "index.js"), "console.log(1)\n", "utf8");
    const c = classifyProject(root);
    expect(c.mode).toBe("brownfield");
    expect(c.signals.sourceFiles).toBe(true);
  });

  it("does not count dotfiles or ignored dirs as source", () => {
    const root = tempRoot();
    writeFileSync(join(root, ".gitignore"), "node_modules\n", "utf8");
    mkdirSync(join(root, "node_modules"), { recursive: true });
    expect(classifyProject(root).signals.sourceFiles).toBe(false);
  });

  it("detects a git history with commits as brownfield", () => {
    const root = tempRoot();
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
    try {
      git("init");
      git("config", "user.email", "t@example.com");
      git("config", "user.name", "Test");
      writeFileSync(join(root, "a.txt"), "hi\n", "utf8");
      git("add", "a.txt");
      git("commit", "-m", "init");
    } catch {
      return; // git not available in this environment — skip gracefully
    }
    const c = classifyProject(root);
    expect(c.signals.gitHistory).toBe(true);
    expect(c.mode).toBe("brownfield");
  });

  it("does not throw and reports no history when there is no git repo", () => {
    expect(() => classifyProject(tempRoot())).not.toThrow();
    expect(classifyProject(tempRoot()).signals.gitHistory).toBe(false);
  });

  it("describeSignals lists the signals that fired", () => {
    expect(describeSignals({ rulesFile: true, sourceFiles: false, gitHistory: true })).toBe(
      "existing agent docs, git history",
    );
  });
});
