import { describe, expect, it } from "vitest";
import { extractTests } from "../../src/core/trace-tests.js";

describe("trace test extraction", () => {
  const src = [
    `it("019:FR-001: a", () => {});`,
    `  test('single quoted', () => {});`,
    "it(`backtick title`, () => {});",
    `it.skip("skipped one", () => {});`,
    `it.todo("todo one");`,
    `it.skipIf(win)("conditional", () => {});`,
    `it.each([1])("each %s", () => {});`,
    String.raw`it("with \"escaped\" quote", () => {});`,
  ].join("\n");

  it("024:FR-001: finds it/test titles with their line numbers", () => {
    const t = extractTests("a.test.ts", src);
    expect(t.map((x) => x.title)).toEqual([
      "019:FR-001: a",
      "single quoted",
      "backtick title",
      "skipped one",
      "todo one",
      "conditional",
      'with "escaped" quote',
    ]);
    expect(t[0]).toMatchObject({ file: "a.test.ts", line: 1 });
    expect(t[1]!.line).toBe(2);
  });

  it("024:FR-003: marks skip and todo as skipped, conditional skipIf and plain tests as live", () => {
    const by = Object.fromEntries(extractTests("a.test.ts", src).map((x) => [x.title, x.skipped]));
    expect(by["skipped one"]).toBe(true);
    expect(by["todo one"]).toBe(true);
    expect(by["conditional"]).toBe(false);
    expect(by["019:FR-001: a"]).toBe(false);
  });

  it("024:FR-001: does not expand .each titles", () => {
    expect(extractTests("a.test.ts", src).some((x) => x.title.startsWith("each"))).toBe(false);
  });
});
