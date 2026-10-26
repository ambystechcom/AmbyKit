import { describe, expect, it } from "vitest";
import type { Presence } from "../../src/core/activity.js";
import { LIVE_TOKENS } from "../../src/cli/ui/dashboard/live-tokens.js";
import { agentBadge, checkoutBadge, checkoutTag, formatAgo, phaseLabel, presenceLabel } from "../../src/cli/ui/dashboard/agent-badge.js";
import { liveIndicator } from "../../src/cli/ui/dashboard/live-indicator.js";
import { iconMode } from "../../src/cli/ui/capabilities.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

/** AgentBadge, PresenceLabel, CheckoutBadge and LiveIndicator in every icon mode (feature 017, FR-025/026, FR-033). */

const unicode = fakeCapabilities({ color: false });
const nerd = fakeCapabilities({ color: false, icons: "nerd" });
const asciiIcons = fakeCapabilities({ color: false, icons: "ascii" });
const ascii = fakeCapabilities({ color: false, unicode: false });
const color = fakeCapabilities();

const p = (agent: string, extra: Partial<Presence> = {}): Presence => ({ agent, source: "reported", state: "active", since: 0, others: [], ...extra });

describe("icon mode (FR-025)", () => {
  it("ascii without unicode or when forced; nerd only when opted in; else unicode", () => {
    expect(iconMode(unicode)).toBe("unicode");
    expect(iconMode(nerd)).toBe("nerd");
    expect(iconMode(asciiIcons)).toBe("ascii");
    expect(iconMode({ ...ascii, icons: "nerd" })).toBe("ascii");
  });
});

describe("AgentBadge", () => {
  it("renders glyph + name per mode", () => {
    expect(agentBadge(unicode, p("claude"))).toBe("✸ Claude");
    expect(agentBadge(ascii, p("codex"))).toBe("[CX] Codex");
    expect(agentBadge(asciiIcons, p("codex"))).toBe("[CX] Codex");
  });

  it("Nerd mode keeps the unicode agent icons (older Nerd Fonts lack the brand glyphs)", () => {
    expect(agentBadge(nerd, p("claude"))).toBe("✸ Claude");
    expect(agentBadge(nerd, p("codex"))).toBe("◎ Codex");
    expect(agentBadge(nerd, p("cursor-cli"))).toBe("➤ Cursor CLI");
  });

  it("detected agents carry the ~ prefix; glyph form drops the name (narrow)", () => {
    expect(agentBadge(unicode, p("codex", { source: "detected" }))).toBe("~ ◎ Codex");
    expect(agentBadge(unicode, p("codex"), "glyph")).toBe("◎");
  });

  it("an unknown id gets the generic badge with its raw id as the name (FR-026)", () => {
    expect(agentBadge(unicode, p("windsurf"))).toBe("● windsurf");
    expect(agentBadge(ascii, p("windsurf"))).toBe("[??] windsurf");
  });

  it("color is identity: painted with the agent token, stripped with NO_COLOR", () => {
    expect(hasAnsi(agentBadge(color, p("claude")))).toBe(true);
    expect(stripAnsi(agentBadge(color, p("claude")))).toBe("✸ Claude");
    expect(hasAnsi(agentBadge(unicode, p("claude")))).toBe(false);
  });
});

describe("PresenceLabel", () => {
  it("glyph + word + age for each state", () => {
    const now = 3 * 3600_000;
    expect(presenceLabel(unicode, p("claude", { since: now - 12_000 }), now)).toBe("● active 12s");
    expect(presenceLabel(unicode, p("claude", { state: "idle", since: now - 18 * 60_000 }), now)).toBe("○ idle 18m");
    expect(presenceLabel(unicode, p("claude", { state: "stale", since: now - 2 * 3600_000 }), now)).toBe("– stale 2h");
    expect(presenceLabel(ascii, p("claude", { state: "idle", since: now }), now)).toBe("[o] idle now");
  });

  it("formatAgo never goes negative (clock skew reads as now)", () => {
    expect(formatAgo(-5000)).toBe("now");
    expect(formatAgo(59_000)).toBe("59s");
    expect(formatAgo(4 * 86_400_000)).toBe("4d");
  });

  it("phase label joins phase and task", () => {
    expect(phaseLabel(unicode, p("claude", { phase: "implement", task: "T014" }))).toBe("implement · T014");
    expect(phaseLabel(ascii, p("claude", { phase: "implement", task: "T014" }))).toBe("implement - T014");
  });
});

describe("CheckoutTag / CheckoutBadge", () => {
  const wt = { root: "/r/.worktrees/017", kind: "worktree" as const, branch: "017-live", dirty: true, stale: true };
  it("short tag and long badge, in unicode and ASCII", () => {
    expect(checkoutTag(unicode, wt)).toBe("⎇●");
    expect(checkoutTag(ascii, wt)).toBe("wt*");
    expect(checkoutTag(unicode, { ...wt, dirty: false })).toBe("⎇⊘");
    expect(checkoutTag(unicode, { root: "/r", kind: "main" })).toBe("");
    expect(checkoutBadge(unicode, wt)).toBe("⎇ 017-live · dirty · merged");
    expect(checkoutBadge(ascii, wt)).toBe("wt 017-live - dirty - merged");
    expect(checkoutBadge(unicode, undefined)).toBe("main");
  });

  it("Nerd mode uses the Octicons git-branch glyph (U+F418); ASCII still spells `wt`", () => {
    expect(checkoutTag(nerd, wt)).toBe("●");
    expect(checkoutBadge(nerd, wt)).toBe(" 017-live · dirty · merged");
    expect(checkoutTag({ ...ascii, icons: "nerd" }, wt)).toBe("wt*");
  });
});

describe("LiveIndicator (FR-014, FR-015)", () => {
  it("watching, polling and paused, in unicode and ASCII", () => {
    expect(liveIndicator(unicode, { mode: "watching", lastChange: 0 }, 3000)).toBe("● live · 3s ago");
    expect(liveIndicator(unicode, { mode: "polling", lastChange: 0 }, 0)).toBe("◌ polling · now");
    expect(liveIndicator(unicode, { mode: "paused", lastChange: 0 }, 0)).toBe("⚠ live paused — r to retry");
    expect(liveIndicator(ascii, { mode: "watching", lastChange: 0 }, 3000)).toBe("live 3s ago");
    expect(liveIndicator(ascii, { mode: "paused", lastChange: 0 }, 0)).toMatch(/live paused - r to retry$/);
  });
});
