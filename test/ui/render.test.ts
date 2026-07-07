import { describe, expect, it } from "vitest";
import * as render from "../../src/cli/ui/render.js";
import { banner } from "../../src/cli/banner.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

describe("render.info — machine-output fidelity (FR-009/010)", () => {
  it("is a byte-identical passthrough for JSON", () => {
    const json = JSON.stringify({ a: 1, b: [2, 3], nested: { x: "y" } }, null, 2);
    expect(render.info(json)).toBe(json);
  });
});

describe("render message kinds (US-1, FR-001)", () => {
  it("success/warn/error carry a glyph + text and colorize when enabled", () => {
    const caps = fakeCapabilities({ color: true, unicode: true });
    expect(stripAnsi(render.success(caps, "done"))).toBe("✓ done");
    expect(stripAnsi(render.warn(caps, "careful"))).toBe("! careful");
    expect(stripAnsi(render.error(caps, "boom"))).toBe("✗ boom");
    expect(hasAnsi(render.success(caps, "done"))).toBe(true);
  });

  it("strips color but keeps glyph + text when color disabled (FR-003)", () => {
    const caps = fakeCapabilities({ color: false, unicode: true });
    expect(render.success(caps, "done")).toBe("✓ done");
    expect(hasAnsi(render.error(caps, "boom"))).toBe(false);
  });

  it("uses ASCII glyphs when unicode disabled (FR-012)", () => {
    const caps = fakeCapabilities({ color: false, unicode: false });
    expect(render.success(caps, "done")).toBe("[ok] done");
    expect(render.warn(caps, "careful")).toBe("! careful");
    expect(render.error(caps, "boom")).toBe("x boom");
  });

  it("error and warn are visually distinct (FR-008)", () => {
    const caps = fakeCapabilities({ color: true, unicode: true });
    expect(render.error(caps, "x")).not.toBe(render.warn(caps, "x"));
  });

  it("error next-step renders an indented muted hint (FR-008)", () => {
    const caps = fakeCapabilities({ color: false, unicode: true });
    const out = render.error(caps, "Not in a project", "Run `ambykit init` first.");
    expect(out).toBe("✗ Not in a project\n  → Run `ambykit init` first.");
  });

  it("heading colorizes with accent when enabled, plain otherwise", () => {
    expect(hasAnsi(render.heading(fakeCapabilities({ color: true }), "Tools"))).toBe(true);
    expect(render.heading(fakeCapabilities({ color: false }), "Tools")).toBe("Tools");
  });
});

describe("banner (US-1, T022)", () => {
  it("colorizes art when color enabled and is plain (with intact text) otherwise", () => {
    expect(hasAnsi(banner(fakeCapabilities({ color: true })))).toBe(true);
    const plain = banner(fakeCapabilities({ color: false }));
    expect(hasAnsi(plain)).toBe(false);
    expect(plain).toContain("Spec-Driven Development for AI coding assistants");
  });
});
