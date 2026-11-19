import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FLEET_TOKENS } from "../../src/cli/ui/dashboard/fleet-tokens.js";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

function merge(a: Obj, b: Obj): Obj {
  const out: Obj = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = a[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && prev && typeof prev === "object" && !Array.isArray(prev)
        ? merge(prev as Obj, v as Obj)
        : v;
  }
  return out;
}

function resolver(root: Obj): (v: Json) => Json {
  const get = (path: string): Json | undefined => path.split(".").reduce<Json | undefined>((o, k) => (o as Obj | undefined)?.[k], root as Json);
  const resolve = (v: Json): Json => {
    if (typeof v === "string") {
      const m = /^\{([^}]+)\}$/.exec(v);
      if (!m) return v;
      const hit = get(m[1]!);
      expect(hit, `unresolved token reference ${v}`).toBeDefined();
      return resolve(hit!);
    }
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]));
    return v;
  };
  return resolve;
}

describe("fleet tokens mirror design-tokens.json (feature 029, T030)", () => {
  const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
  const t14 = read("specs/014-enhanced-dashboard/design-tokens.json");
  const t17 = read("specs/017-live-dashboard/design-tokens.json");
  const t29 = read("specs/029-fleet-control-room/design-tokens.json");
  const root = {
    primitive: merge(merge(t14.primitive, t17.primitive), t29.primitive),
    semantic: merge(merge(t14.semantic, t17.semantic), t29.semantic),
    component: merge(merge(t14.component, t17.component), t29.component),
  };
  const resolve = resolver(root);

  it("029:FR-010: matches every resolved 029 token", () => {
    expect(FLEET_TOKENS).toEqual({
      glyph: resolve(t29.primitive.glyph),
      word: t29.primitive.word,
      text: t29.primitive.text,
      space: t29.primitive.space,
      limit: t29.primitive.limit,
      semantic: resolve(t29.semantic),
      component: resolve(t29.component),
    });
  });

  it("029:FR-010: the design is signed off and records the five decisions", () => {
    expect(t29.signed_off).toBe(true);
    expect(t29.$decisions).toHaveLength(5);
  });

  it("029:FR-010: every state has a glyph for each icon mode and a word (no state depends on a glyph)", () => {
    for (const state of ["working", "waiting", "blocked", "paused", "done", "unreported", "unknown"] as const) {
      const t = FLEET_TOKENS.component["fleet-lane"].state[state];
      expect(t.word.length).toBeGreaterThan(0);
      expect(t.glyph.u.length).toBeGreaterThan(0);
      expect(t.glyph.a.length).toBeGreaterThan(0);
      expect(t.nerd.u.length).toBeGreaterThan(0);
    }
  });
});
