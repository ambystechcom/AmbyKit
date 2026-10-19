import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOKENS } from "../../src/cli/ui/dashboard/tokens.js";
import { paintToken } from "../../src/cli/ui/theme.js";
import { fakeCapabilities } from "./helpers.js";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Resolve every `{tier.path}` reference in the token file. */
function resolveAll(root: Record<string, Json>): (v: Json) => Json {
  const get = (path: string): Json =>
    path.split(".").reduce<Json>((o, k) => (o as Record<string, Json>)[k] as Json, root as Json);
  const resolve = (v: Json): Json => {
    if (typeof v === "string") {
      const m = /^\{([^}]+)\}$/.exec(v);
      return m ? resolve(get(m[1]!)) : v;
    }
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]));
    return v;
  };
  return resolve;
}

describe("dashboard tokens mirror design-tokens.json (feature 014)", () => {
  const json = JSON.parse(readFileSync("specs/014-enhanced-dashboard/design-tokens.json", "utf8"));
  const resolve = resolveAll({ primitive: json.primitive, semantic: json.semantic, component: json.component });

  it("matches every resolved primitive, semantic and component token", () => {
    expect(TOKENS).toEqual({
      glyph: resolve(json.primitive.glyph),
      space: json.primitive.space,
      limit: json.primitive.limit,
      semantic: resolve(json.semantic),
      component: resolve(json.component),
    });
  });
});

describe("paintToken (R-3)", () => {
  const accent = TOKENS.semantic.color.accent;

  it("truecolor dark/light picks the background's hex", () => {
    expect(paintToken(fakeCapabilities({ truecolor: true }), accent, "x")).toBe("\x1b[38;2;255;77;183mx\x1b[0m");
    expect(paintToken(fakeCapabilities({ truecolor: true, background: "light" }), accent, "x")).toBe(
      "\x1b[38;2;194;20;137mx\x1b[0m",
    );
  });

  it("falls back to ansi16, adds bold, and is a no-op without color", () => {
    expect(paintToken(fakeCapabilities(), accent, "x")).toBe("\x1b[35mx\x1b[0m");
    expect(paintToken(fakeCapabilities(), accent, "x", true)).toBe("\x1b[1;35mx\x1b[0m");
    expect(paintToken(fakeCapabilities({ color: false }), accent, "x")).toBe("x");
  });

  it("an SGR-valued truecolor token passes through", () => {
    expect(paintToken(fakeCapabilities({ truecolor: true }), TOKENS.semantic.color.text, "x")).toBe("\x1b[39mx\x1b[0m");
  });
});
