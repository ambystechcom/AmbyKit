import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TAB_TOKENS } from "../../src/cli/ui/dashboard/tab-tokens.js";

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

describe("tab tokens mirror design-tokens.json (feature 032, T060)", () => {
  const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
  const t14 = read("specs/014-enhanced-dashboard/design-tokens.json");
  const t17 = read("specs/017-live-dashboard/design-tokens.json");
  const t29 = read("specs/029-fleet-control-room/design-tokens.json");
  const t32 = read("specs/032-dashboard-redesign-and-metrics/design-tokens.json");
  const all = [t14, t17, t29, t32];
  const tier = (name: "primitive" | "semantic" | "component"): Obj => all.reduce<Obj>((acc, t) => merge(acc, t[name] ?? {}), {});
  const resolve = resolver({ primitive: tier("primitive"), semantic: tier("semantic"), component: tier("component") });

  it("032:FR-015: matches every resolved 032 token", () => {
    expect(TAB_TOKENS).toEqual({
      glyph: resolve(t32.primitive.glyph),
      word: t32.primitive.word,
      space: t32.primitive.space,
      limit: t32.primitive.limit,
      semantic: resolve(t32.semantic),
      component: resolve(t32.component),
    });
  });

  it("032:FR-015: the design is signed off", () => {
    expect(t32.signed_off).toBe(true);
    expect(t32.signed_off_by).toBeTruthy();
  });

  it("032:FR-012: every state has a word, and a glyph for each icon mode (no state depends on a glyph or a color)", () => {
    for (const state of ["working", "waiting", "blocked", "paused", "done", "stalled"] as const) {
      const t = TAB_TOKENS.semantic.state[state];
      expect(t.word.length).toBeGreaterThan(0);
      expect(t.glyph.u.length).toBeGreaterThan(0);
      expect(t.glyph.a.length).toBeGreaterThan(0);
    }
  });
});
