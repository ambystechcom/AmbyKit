import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeGraph } from "../../src/core/analyze.js";
import { buildGraph } from "../../src/core/graph.js";
import { toJson } from "../../src/core/graph-format.js";
import { blockersOf } from "../../src/core/graph-paths.js";
import { attentionItems } from "../../src/core/overview.js";
import { feature, story } from "../helpers/graph-fixtures.js";

const src = join(import.meta.dirname, "..", "..", "src");

function sources(dir = src): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
  );
}
const where = (needle: string | RegExp): string[] =>
  sources()
    .filter((f) => (typeof needle === "string" ? readFileSync(f, "utf8").includes(needle) : needle.test(readFileSync(f, "utf8"))))
    .map((f) => relative(src, f).replace(/\\/g, "/"))
    .sort();

describe("one parser, one resolver (FR-011)", () => {
  it("the `depends-on` / `blocked-by` lines are read only by parseStories", () => {
    expect(where("**depends-on:**")).toEqual([]);
    expect(where(/\\\*\\\*depends-on:/)).toEqual(["core/dashboard.ts"]);
    expect(where(/\\\*\\\*blocked-by:/)).toEqual(["core/dashboard.ts"]);
  });

  it("the cross-feature reference syntax is resolved only in graph.ts", () => {
    expect(where("(\\d+)[:/]?(US")).toEqual(["core/graph.ts"]);
  });

  it("no consumer keeps a private resolver or cycle finder", () => {
    expect(where(/function resolveDep\(/)).toEqual([]);
    expect(where(/function cycleKeys\(/)).toEqual([]);
    expect(where(/function indexStories\(/)).toEqual([]);
  });

  it("analyze, the dashboard overview and story detail all import the shared graph", () => {
    expect(where(/from "\.\/graph\.js"/)).toEqual(expect.arrayContaining(["core/analyze.ts", "core/overview.ts"]));
    expect(where(/core\/graph\.js/)).toEqual(expect.arrayContaining(["cli/graph.ts", "cli/ui/dashboard/story-detail.ts"]));
  });
});

/** Blockers every consumer must agree on (SC-003): acyclic, nothing dangling, a mix of done and open targets. */
const features = () => [
  feature("904-base", [
    story("904-base", "US1", { status: "done" }),
    story("904-base", "US2", { status: "in-progress" }),
    story("904-base", "US3"),
  ]),
  feature("905-top", [
    story("905-top", "US1", { dependsOn: ["904US1"] }),
    story("905-top", "US2", { dependsOn: ["904US2"] }),
    story("905-top", "US3", { blockedBy: ["904US1"] }),
    story("905-top", "US4", { blockedBy: ["904US2"] }),
    story("905-top", "US5", { dependsOn: ["US2", "904US3"], blockedBy: ["US4"] }),
    story("905-top", "US6", { status: "done", dependsOn: ["US2"] }),
  ]),
];

describe("analyze, the dashboard and `ambykit graph` agree on blockers (SC-003)", () => {
  // analyze and graph name every open blocker; the dashboard names the highest-ranked kind (existing behaviour, FR-017).
  const all = features();
  const stories = all.flatMap((f) => f.stories);
  const graph = buildGraph(all);
  const json = toJson(graph);
  const idOf = new Map(graph.nodes.map((n) => [n.key, n.id]));
  const keyOf = (dir: string, id: string): string => `${dir}:${id}`;

  /** Blockers named by `ambykit graph --json`: edge targets that are not done. */
  const fromJson = (id: string): string[] => {
    const status = new Map(json.nodes.map((n) => [n.id, n.status]));
    return [...new Set(json.edges.filter((e) => e.from === id && status.get(e.to) !== "done").map((e) => e.to))].sort();
  };
  /** Blockers named by `analyze`. */
  const report = analyzeGraph(stories);
  const fromAnalyze = (id: string): string[] =>
    [...(report.blocked.find((b) => b.displayId === id)?.on ?? [])].sort();
  /** Blockers named by the dashboard's attention list (labels are local or qualified: normalise). */
  const attention = attentionItems(all, all);
  const fromAttention = (id: string): string[] => {
    const item = attention.find((a) => a.key === id && (a.kind === "blocked" || a.kind === "waiting"));
    const [ref] = id.split(":");
    return (item?.refs ?? []).map((r) => (r.includes(":") ? r : `${ref}:${r}`)).sort();
  };

  it("names the same blockers for every story", () => {
    let withBlockers = 0;
    for (const f of all) {
      for (const s of f.stories) {
        const id = idOf.get(keyOf(f.dir, s.id))!;
        if (s.status === "done") continue;
        const expected = blockersOf(graph, keyOf(f.dir, s.id)).map((b) => idOf.get(b.key)!).sort();
        expect(fromJson(id), `graph --json ${id}`).toEqual(expected);
        expect(fromAnalyze(id), `analyze ${id}`).toEqual(expected);
        // The dashboard names each story once, in its highest-ranked kind: open `blocked-by` blockers
        // first, else open `depends-on` ones. So it names a subset of the full set, never anything else.
        const open = (kind: string): string[] =>
          [...new Set(graph.edges.filter((e) => e.from === keyOf(f.dir, s.id) && e.kind === kind).map((e) => e.to))]
            .filter((to) => graph.nodes.find((n) => n.key === to)?.status !== "done")
            .map((to) => idOf.get(to)!)
            .sort();
        const ranked = open("blocked-by").length > 0 ? open("blocked-by") : open("depends-on");
        expect(fromAttention(id), `dashboard attention ${id}`).toEqual(ranked);
        for (const named of fromAttention(id)) expect(expected, `${id} names a real blocker`).toContain(named);
        if (expected.length > 0) withBlockers += 1;
      }
    }
    expect(withBlockers).toBe(3);
  });

  it("changing one dependency changes all three the same way", () => {
    const changed = features();
    changed[1]!.stories[0]!.dependsOn = ["904US2"]; // 905:US-1 now waits on 904:US-2 instead of the done 904:US-1
    const g = buildGraph(changed);
    const j = toJson(g);
    const a = analyzeGraph(changed.flatMap((f) => f.stories));
    const att = attentionItems(changed, changed);
    expect(j.edges.some((e) => e.from === "905:US-1" && e.to === "904:US-2")).toBe(true);
    expect(a.blocked.find((b) => b.displayId === "905:US-1")?.on).toEqual(["904:US-2"]);
    expect(att.find((x) => x.key === "905:US-1")?.refs).toEqual(["904:US-2"]);
  });
});
