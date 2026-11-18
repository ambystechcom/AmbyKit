import { nextRoundAction, type VerdictResult } from "./fleet/run-flow.js";

/**
 * The review loop's state machine (feature 028, FR-018, SC-009). Pure: it takes where a lane is in the loop and
 * what the last reviewer wrote, and says what happens next. The verdict contract is spec 019's
 * (`verdicts/<lane>.<role>.<round>.json`, parsed by `parseVerdict`); the round limit is `fleet.roundLimit`.
 * Order is QA first, then the architect; a failure from either goes back to the same lane's worker as finding
 * IDs only, and after `limit` failed rounds the loop stops and asks a person.
 */

export type Reviewer = "qa" | "architect";

export type ReviewStep =
  /** The reviewer has not run this round: launch it. */
  | { kind: "launch"; role: Reviewer; round: number }
  /** QA passed: the architect reviews next. */
  | { kind: "advance"; to: "architect" }
  /** Both passed: the lane may merge. */
  | { kind: "pass" }
  /** A failure under the limit: the worker fixes exactly these findings, then the next round starts at QA. */
  | { kind: "fix"; findings: string[]; failedRounds: number }
  /** The loop ends here and a person decides. */
  | { kind: "escalate"; reason: string; findings: string[]; failedRounds: number };

export interface ReviewInput {
  stage: Reviewer;
  round: number;
  /** Rounds of this lane that already ended in a failure. */
  failedRounds: number;
  limit: number;
  /** The reviewer's process for this round has finished. */
  reviewerDone: boolean;
  /** The parsed verdict file; `null` = no file. Ignored until `reviewerDone`. */
  verdict: VerdictResult | null;
}

export function reviewStep(input: ReviewInput): ReviewStep {
  if (!input.reviewerDone) return { kind: "launch", role: input.stage, round: input.round };
  if (input.verdict === null) {
    return { kind: "escalate", reason: `the ${input.stage} reviewer wrote no verdict for round ${input.round}`, findings: [], failedRounds: input.failedRounds };
  }
  if (!input.verdict.ok) {
    return { kind: "escalate", reason: `the ${input.stage} verdict for round ${input.round} is invalid: ${input.verdict.error}`, findings: [], failedRounds: input.failedRounds };
  }
  if (input.verdict.verdict.verdict === "pass") return input.stage === "qa" ? { kind: "advance", to: "architect" } : { kind: "pass" };
  const failed = input.failedRounds + 1;
  const ids = input.verdict.failingIds;
  if (nextRoundAction(failed, input.limit) === "escalate") {
    return { kind: "escalate", reason: `still failing after ${failed} review round${failed === 1 ? "" : "s"} (limit ${input.limit})`, findings: ids, failedRounds: failed };
  }
  return { kind: "fix", findings: ids, failedRounds: failed };
}
