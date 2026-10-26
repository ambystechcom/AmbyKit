import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIVE_TOKENS } from "../../src/cli/ui/dashboard/live-tokens.js";

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

/** Resolve every `{tier.path}` reference against the merged 014 + 017 tree. */
function resolveAll(root: Obj): (v: Json) => Json {
  const get = (path: string): Json | undefined =>
    path.split(".").reduce<Json | undefined>((o, k) => (o as Obj | undefined)?.[k], root as Json);
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

describe("live tokens mirror design-tokens.json (feature 017)", () => {
  const base = JSON.parse(readFileSync("specs/014-enhanced-dashboard/design-tokens.json", "utf8"));
  const ext = JSON.parse(readFileSync("specs/017-live-dashboard/design-tokens.json", "utf8"));
  const root = {
    primitive: merge(base.primitive, ext.primitive),
    semantic: merge(base.semantic, ext.semantic),
    component: merge(base.component, ext.component),
  };
  const resolve = resolveAll(root);

  it("matches every resolved 017 token", () => {
    expect(LIVE_TOKENS).toEqual({
      glyph: resolve(ext.primitive.glyph),
      nerd: resolve(ext.primitive.nerd),
      time: ext.primitive.time,
      limit: ext.primitive.limit,
      semantic: resolve(ext.semantic),
      component: resolve(ext.component),
    });
  });

  it("records AA contrast (≥ 4.5) for every agent text color", () => {
    for (const bg of ["dark", "light"] as const) {
      const entries = Object.entries(ext.$contrast[bg] as Record<string, number>);
      expect(entries.length).toBeGreaterThanOrEqual(6);
      for (const [name, ratio] of entries) expect(ratio, name).toBeGreaterThanOrEqual(4.5);
    }
  });
});
