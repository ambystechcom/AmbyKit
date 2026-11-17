import { describe, expect, it } from "vitest";
import { runTrace, specWith, traceFixture } from "../helpers/trace-fixture.js";

const TESTS = [
  "- [TC-001] [US-1#1] [FR-001] auto — does a → ok",
  "- [TC-002] [US-1#2] [FR-002] auto — does b → ok",
  "- [TC-003] [US-1#3] [FR-002] manual:visual-check — looks right → fine; verify: look; record: notes",
].join("\n");

describe("trace test design (spec 021)", () => {
  const files = { "t/a.test.ts": `it("019:FR-001: a", () => {});` };

  it("024:FR-017: designed automated cases are matched or missing and manual ones listed", async () => {
    const root = traceFixture({ specs: { "019-a": { "spec.md": specWith("FR-001", "FR-002"), "tests.md": TESTS } }, files });
    const r = JSON.parse((await runTrace(root, [], { json: true })).out);
    expect(r.features[0].design.cases.map((c: { id: string; state: string }) => `${c.id}:${c.state}`)).toEqual([
      "TC-001:matched",
      "TC-002:missing",
      "TC-003:manual",
    ]);
    expect((await runTrace(root)).out).toMatch(/missing\s+TC-002/);
  });

  it("024:FR-018: a feature without test design reports exactly the requirement-only output", async () => {
    const plain = traceFixture({ specs: { "019-a": specWith("FR-001", "FR-002") }, files });
    const skipped = traceFixture({ specs: { "019-a": { "spec.md": specWith("FR-001", "FR-002"), "tests.md": "skipped: trivial\n" } }, files });
    const a = await runTrace(plain);
    const b = await runTrace(skipped);
    expect(b.out).toBe(a.out);
    expect(a.out).not.toContain("designed cases");
  });
});
