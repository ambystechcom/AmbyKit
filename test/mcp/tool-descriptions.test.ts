import { describe, expect, it } from "vitest";
import { DIRECTIVE_PROTOCOL, REPORT_CADENCE } from "../../src/mcp/tools/fleet.js";
import { buildRegistry } from "../../src/mcp/tools/index.js";

const description = (name: string): string => buildRegistry().list().find((t) => t.name === name)!.description;

describe("tool descriptions state the worker protocol", () => {
  it("025:FR-013: report_activity says when to report: task start, task end, blocked or waiting, never on a timer", () => {
    const d = description("report_activity");
    expect(d).toContain(REPORT_CADENCE);
    expect(REPORT_CADENCE).toMatch(/start of a task/);
    expect(REPORT_CADENCE).toMatch(/end of a task/);
    expect(REPORT_CADENCE).toMatch(/blocked or waiting/);
    expect(REPORT_CADENCE).toMatch(/Never report on a timer/);
  });

  it("025:FR-020: report_activity says to finish the current task, then obey pause or stop at the next report", () => {
    const d = description("report_activity");
    expect(d).toContain(DIRECTIVE_PROTOCOL);
    expect(DIRECTIVE_PROTOCOL).toMatch(/finish the task you are on/);
    expect(DIRECTIVE_PROTOCOL).toMatch(/obey it at your next report/);
  });

  it("025:FR-020: the wording is exactly the text spec 019's worker prompt must carry (pinned here)", () => {
    expect(REPORT_CADENCE).toBe(
      "Report at the start of a task, at the end of a task, and whenever you are blocked or waiting. Never report on a timer and never report progress.",
    );
    expect(DIRECTIVE_PROTOCOL).toBe(
      "The reply carries a directive: continue, pause or stop. On pause or stop, finish the task you are on, then obey it at your next report: do not start another task.",
    );
  });
});
