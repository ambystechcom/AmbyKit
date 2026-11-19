import { describe, expect, it } from "vitest";
import { parseVerdict } from "../../src/core/fleet/index.js";
import { reviewStep, type ReviewInput } from "../../src/core/run-review.js";

const pass = parseVerdict(JSON.stringify({ verdict: "pass", findings: [] }));
const fail = (...ids: string[]) =>
  parseVerdict(JSON.stringify({ verdict: "fail", findings: ids.map((id) => ({ id, severity: "high", finding: `${id} bad`, fix: "fix" })) }));

const base: ReviewInput = { stage: "qa", round: 1, failedRounds: 0, limit: 3, reviewerDone: true, verdict: pass };

describe("review loop state machine (feature 028)", () => {
  it("028:FR-018: a reviewer that has not run yet is launched for this round", () => {
    expect(reviewStep({ ...base, reviewerDone: false, verdict: null })).toEqual({ kind: "launch", role: "qa", round: 1 });
    expect(reviewStep({ ...base, stage: "architect", round: 2, reviewerDone: false, verdict: null })).toEqual({ kind: "launch", role: "architect", round: 2 });
  });

  it("028:FR-018: QA passing hands over to the architect; the architect passing passes the lane", () => {
    expect(reviewStep(base)).toEqual({ kind: "advance", to: "architect" });
    expect(reviewStep({ ...base, stage: "architect" })).toEqual({ kind: "pass" });
  });

  it("028:SC-009: a failure under the limit goes back to the worker as finding IDs only", () => {
    const step = reviewStep({ ...base, verdict: fail("QA-1", "QA-2") });
    expect(step).toEqual({ kind: "fix", findings: ["QA-1", "QA-2"], failedRounds: 1 });
  });

  it("028:SC-009: the loop is bounded: at the round limit it escalates instead of fixing again", () => {
    expect(reviewStep({ ...base, failedRounds: 1, verdict: fail("A") }).kind).toBe("fix");
    const last = reviewStep({ ...base, failedRounds: 2, verdict: fail("A", "B") });
    expect(last).toMatchObject({ kind: "escalate", findings: ["A", "B"], failedRounds: 3 });
    expect((last as { reason: string }).reason).toContain("limit 3");
  });

  it("028:SC-009: the limit is the one in fleet.roundLimit: a limit of 1 escalates on the first failure", () => {
    expect(reviewStep({ ...base, limit: 1, verdict: fail("A") }).kind).toBe("escalate");
  });

  it("028:SC-009: a limit below 1 never loops: it is read as escalate", () => {
    expect(reviewStep({ ...base, limit: 0, verdict: fail("A") }).kind).toBe("escalate");
    expect(reviewStep({ ...base, limit: Number.NaN, verdict: fail("A") }).kind).toBe("escalate");
  });

  it("028:FR-018: a reviewer that wrote no verdict, or an invalid one, escalates with the reason (it is never read as a pass)", () => {
    const none = reviewStep({ ...base, verdict: null });
    expect(none).toMatchObject({ kind: "escalate", findings: [] });
    expect((none as { reason: string }).reason).toContain("no verdict");
    const bad = reviewStep({ ...base, verdict: parseVerdict("not json") });
    expect((bad as { reason: string }).reason).toContain("invalid");
    const empty = reviewStep({ ...base, verdict: parseVerdict(JSON.stringify({ verdict: "fail", findings: [] })) });
    expect(empty.kind).toBe("escalate");
  });

  it("028:FR-018: the architect's failure counts against the same limit as QA's", () => {
    expect(reviewStep({ ...base, stage: "architect", failedRounds: 2, verdict: fail("ARCH-1") }).kind).toBe("escalate");
  });
});
