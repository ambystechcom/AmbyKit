import { describe, expect, it } from "vitest";
import { spinner, summarize } from "../../src/cli/ui/progress.js";
import type { ChangeSummary } from "../../src/cli/ui/types.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

function makeSummary(over: Partial<ChangeSummary> = {}): ChangeSummary {
  return { created: [], updated: [], unchanged: [], skipped: [], wouldChange: [], dryRun: false, ...over };
}

/** Collect everything written to a fake stream. */
function fakeStream(isTTY: boolean): { isTTY: boolean; write: (s: string) => boolean; text: () => string } {
  const chunks: string[] = [];
  return { isTTY, write: (s) => (chunks.push(s), true), text: () => chunks.join("") };
}

describe("summarize (FR-006)", () => {
  it("shows created/updated/unchanged counts (non-dry)", () => {
    const out = stripAnsi(
      summarize(fakeCapabilities(), makeSummary({ created: ["a", "b"], updated: ["c"], unchanged: ["d", "e", "f"] })),
    );
    expect(out).toMatch(/created\s+2/);
    expect(out).toMatch(/updated\s+1/);
    expect(out).toMatch(/unchanged\s+3/);
  });

  it("omits zero-count rows", () => {
    const out = stripAnsi(summarize(fakeCapabilities(), makeSummary({ created: ["a"] })));
    expect(out).toContain("created");
    expect(out).not.toContain("updated");
    expect(out).not.toContain("unchanged");
  });

  it("uses 'would change' wording in dry-run", () => {
    const out = stripAnsi(summarize(fakeCapabilities(), makeSummary({ wouldChange: ["a", "b"], dryRun: true })));
    expect(out).toContain("would change");
    expect(out).not.toContain("created");
  });

  it("notes the --include-user remedy when files were skipped", () => {
    const out = stripAnsi(
      summarize(fakeCapabilities(), makeSummary({ created: ["x"], skipped: ["~/.copilot/x"] })),
    );
    expect(out).toMatch(/skipped\s+1\s+\(use --include-user\)/);
  });
});

describe("spinner (FR-005)", () => {
  it("emits nothing on start and no control codes on a non-TTY", () => {
    const out = fakeStream(false);
    const spin = spinner(fakeCapabilities({ isTTY: false, color: false }), out);
    spin.start("working");
    expect(out.text()).toBe(""); // no frames while non-interactive
    spin.succeed("done");
    expect(hasAnsi(out.text())).toBe(false);
    expect(out.text()).toContain("done");
  });

  it("draws a frame and clears the line on a TTY", () => {
    const out = fakeStream(true);
    const spin = spinner(fakeCapabilities({ isTTY: true, color: true, unicode: true }), out);
    spin.start("working");
    expect(out.text()).toContain("working"); // first frame drawn immediately
    spin.succeed("done");
    expect(out.text()).toContain("\r\x1b[K"); // clears the spinner line before the ✓
    expect(out.text()).toContain("done");
  });
});
