import { describe, expect, it } from "vitest";
import { AGENTS } from "../../src/core/agents.js";
import { LIVE_TOKENS } from "../../src/cli/ui/dashboard/live-tokens.js";
import { getTarget } from "../../src/emitters/index.js";

/** Both Antigravity ids keep their identity in the dashboard (feature 018, FR-012). */
describe("Antigravity identities", () => {
  it.each(["antigravity", "antigravity-cli"])("%s is still a selectable target and a dashboard agent", (id) => {
    expect(getTarget(id)).toBeDefined();
    expect(AGENTS[id]?.family).toBe("antigravity");
    expect((LIVE_TOKENS.component.agent as Record<string, unknown>)[id]).toBeDefined();
  });
});
