import { describe, expect, it } from "vitest";
import { AGENTS } from "../../src/core/agents.js";
import { LIVE_TOKENS } from "../../src/cli/ui/dashboard/live-tokens.js";

/** Both Antigravity ids keep their identity in the dashboard (feature 018, FR-012). */
describe("Antigravity identities", () => {
  it.each(["antigravity", "antigravity-cli"])("%s is still a known agent id and a dashboard agent (the targets themselves come from the plugin since 2.0)", (id) => {
    expect(AGENTS[id]?.family).toBe("antigravity");
    expect((LIVE_TOKENS.component.agent as Record<string, unknown>)[id]).toBeDefined();
  });
});
