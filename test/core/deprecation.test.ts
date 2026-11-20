import { beforeEach, describe, expect, it } from "vitest";
import { deprecated, deprecationLine, resetDeprecations } from "../../src/core/deprecation.js";

/** Feature 033 (US-5): the deprecation notice is one line naming the replacement, once per process, on the error stream. */

describe("deprecation notice (feature 033)", () => {
  beforeEach(() => resetDeprecations());

  it("033:FR-010: the line names the deprecated name, the next major and the replacement", () => {
    const line = deprecationLine("--old-flag", "--new-flag");
    expect(line).toContain("'--old-flag' is deprecated");
    expect(line).toContain("next major release");
    expect(line).toContain("use '--new-flag'");
    expect(line.includes("\n")).toBe(false);
  });

  it("033:FR-011: the notice prints once per process, however often the name is used", () => {
    const lines: string[] = [];
    const write = (l: string): void => void lines.push(l);
    expect(deprecated("--old-flag", "--new-flag", write)).toBe(true);
    expect(deprecated("--old-flag", "--new-flag", write)).toBe(false);
    expect(deprecated("--old-flag", "--new-flag", write)).toBe(false);
    expect(lines).toHaveLength(1);
  });

  it("033:FR-011: each deprecated name has its own notice", () => {
    const lines: string[] = [];
    const write = (l: string): void => void lines.push(l);
    deprecated("--a", "--b", write);
    deprecated("--c", "--d", write);
    expect(lines).toHaveLength(2);
  });

  it("033:FR-011: by default the notice goes to stderr, never stdout, and the caller's behaviour is unchanged", () => {
    const err: string[] = [];
    const out: string[] = [];
    const [e, o] = [process.stderr.write, process.stdout.write];
    process.stderr.write = ((s: string) => (err.push(String(s)), true)) as typeof process.stderr.write;
    process.stdout.write = ((s: string) => (out.push(String(s)), true)) as typeof process.stdout.write;
    let result: string;
    try {
      deprecated("old-verb", "new-verb");
      result = "still works"; // the command carries on after the notice
    } finally {
      [process.stderr.write, process.stdout.write] = [e, o];
    }
    expect(err.join("")).toContain("'old-verb' is deprecated");
    expect(out.join("")).toBe("");
    expect(result).toBe("still works");
  });

  it("033:FR-010: a hypothetical rename follows the policy: notice in a minor, name still works", () => {
    // The policy (docs/stability.md): deprecate in a minor release, remove in the next major. The notice is the whole
    // visible change in the minor; the old name keeps running.
    const lines: string[] = [];
    const oldName = (): string => (deprecated("--legacy", "--modern", (l) => void lines.push(l)), "ran");
    expect(oldName()).toBe("ran");
    expect(oldName()).toBe("ran");
    expect(lines).toEqual([deprecationLine("--legacy", "--modern")]);
  });
});
