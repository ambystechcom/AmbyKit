import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { RunCommand } from "../src/cli/run.js";
import type { FleetRecord } from "../src/core/fleet-plan/types.js";
import { DIRECTIVE_ACTIONS, listRuns, writeDirective, writeFleetRecord } from "../src/core/fleet/index.js";
import { loadPlugins, validateShape } from "../src/plugins/loader.js";
import { checkContract, type Facts } from "./helpers/contract-check.js";
import { parseContractBlocks, contractFor, type ContractBlock } from "./helpers/contract-doc.js";
import { gitProject, HAS_GIT } from "./helpers/git-repo.js";
import { pluginProject } from "./helpers/plugin-project.js";
import { FakePort, fakeRegistry, preparedProject, script } from "./helpers/run-fakes.js";
import { runCommand } from "./helpers/run-command.js";

/**
 * The stability contract (feature 033, FR-001, FR-013, SC-004). `docs/stability.md` lists what `run` and the plugin API promise;
 * this test reads those lists and checks every item against the code, so the document and the code cannot drift: a listed flag,
 * exit code, state file, printed line, directive field or export that disappears fails here. What the document does not list is
 * not promised and is not checked (FR-002); adding something is allowed (FR-003).
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = join(ROOT, "docs", "stability.md");
const F = "028-ambykit-run";
const noSleep = async (): Promise<void> => undefined;

/** Type export names of a source file: `export type { A, B }`, `export interface X`, `export type X =`. */
function typeExports(file: string): Set<string> {
  const text = readFileSync(join(ROOT, file), "utf8");
  const names = new Set<string>();
  for (const m of text.matchAll(/export type\s*\{([^}]*)\}/g)) {
    for (const part of m[1]!.split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()!.trim();
      if (name) names.add(name);
    }
  }
  for (const m of text.matchAll(/export (?:interface|type)\s+([A-Za-z0-9_]+)/g)) names.add(m[1]!);
  return names;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const GOOD_DESCRIPTOR = (): Record<string, unknown> => ({
  targets: [
    {
      id: "demo",
      displayName: "Demo",
      emitter: { toolId: "demo", displayName: "Demo", commandSurface: "commands", commandDir: ".demo", emit: () => [] },
    },
  ],
});

/** Does removing the key at `path` (`targets`, `targets[].id`, `targets[].emitter.toolId`, …) make the loader's shape check fail? */
function descriptorKeyRequired(path: string): boolean {
  if (validateShape(GOOD_DESCRIPTOR()).length > 0) return false;
  const mod = GOOD_DESCRIPTOR();
  const segments = path.split(".");
  let at: Record<string, unknown> = mod;
  for (const seg of segments.slice(0, -1)) {
    const next = seg.endsWith("[]") ? (at[seg.slice(0, -2)] as unknown[])[0] : at[seg];
    at = next as Record<string, unknown>;
  }
  const last = segments.at(-1)!;
  delete at[last.endsWith("[]") ? last.slice(0, -2) : last];
  return validateShape(mod).length > 0;
}

async function loadingRules(): Promise<Record<string, boolean>> {
  const refused = async (root: string, listed: Record<string, string>): Promise<boolean> => (await loadPlugins(root, listed)).failures.length > 0;
  const withFake = pluginProject({ plugins: { "ambykit-emitter-fake": "1.2.3" } });
  const empty = pluginProject({});
  const wrongRange = pluginProject({ plugins: { "ambykit-emitter-wrongrange": "1.0.0" } });
  return {
    "exact-pin": await refused(withFake, { "ambykit-emitter-fake": "^1.2.3" }),
    "project-node-modules": await refused(empty, { "ambykit-emitter-fake": "1.2.3" }),
    "package-name": await refused(empty, { "not-a-plugin": "1.0.0" }),
    "api-range": await refused(wrongRange, { "ambykit-emitter-wrongrange": "1.0.0" }),
  };
}

async function gatherFacts(): Promise<Facts> {
  // One real run with fake assistants: the printed lines, the exit code and the state files all come from it.
  const p = await preparedProject(F, 4, 2);
  const port = new FakePort();
  script({ port }, p, { work: true });
  const cmd = new RunCommand({ registry: fakeRegistry(), port, sleep: noSleep });
  const full = await runCommand(cmd, p.root, [F], { yes: true, assistant: "claude,codex" });
  const run = listRuns(p.root, F)[0]!.run;

  const written = writeDirective(p.root, { feature: F, lane: "lane-1-1", action: "pause", run });
  const directiveFile = join(p.root, ".amby", "fleet", run, "directives", "lane-1-1.json");
  const directiveKeys = existsSync(directiveFile) ? Object.keys(JSON.parse(readFileSync(directiveFile, "utf8")) as object) : [];
  if (!written.ok) throw new Error(`could not write a directive: ${written.error}`);
  writeFleetRecord(p.root, { fleet: "fleet-1", status: "active", createdAt: new Date().toISOString(), features: [] } as unknown as FleetRecord);

  const stateFiles = new Set(
    walk(join(p.root, ".amby", "fleet")).map((f) =>
      relative(p.root, f)
        .split(sep)
        .join("/")
        .replace(run, "<run>")
        .replace(/lane-\d+-\d+/g, "<lane>")
        .replace(/fleet-\d+\//, "<fleet>/"),
    ),
  );

  const noFeature = await runCommand(new RunCommand({ registry: fakeRegistry(), port: new FakePort(), sleep: noSleep }), gitProject([F]), []);
  const runners = await runCommand(new RunCommand({ registry: fakeRegistry(), port: new FakePort(), sleep: noSleep }), gitProject([F]), [], { runners: true });

  const plugin = await import("../src/plugins/index.js");
  const kit = await import("../src/testkit/index.js");
  const rules = await loadingRules();
  return {
    usage: new RunCommand().usage,
    observedExitCodes: new Set([full.code, noFeature.code, runners.code]),
    runOutput: `${full.out}\n${full.err}`,
    stateFiles,
    directiveActions: [...DIRECTIVE_ACTIONS],
    directiveKeys,
    exports: {
      plugin: { values: new Set(Object.keys(plugin)), types: typeExports("src/plugins/index.ts") },
      kit: { values: new Set(Object.keys(kit)), types: typeExports("src/testkit/index.ts") },
    },
    plugin: {
      refused: (rule) => rules[rule],
      descriptorKeyRequired: (path) => {
        try {
          return descriptorKeyRequired(path);
        } catch {
          return undefined;
        }
      },
    },
  };
}

describe.skipIf(!HAS_GIT)("the stability contract matches the code (feature 033)", () => {
  let facts: Facts;
  let blocks: ContractBlock[];
  beforeAll(async () => {
    facts = await gatherFacts();
    blocks = parseContractBlocks(readFileSync(DOC, "utf8"));
  }, 90_000);

  it("033:FR-013, 033:SC-004: every item listed in docs/stability.md is true of the code", () => {
    expect(checkContract(blocks, facts)).toEqual([]);
  });

  it("033:FR-002: something the code has that the document does not list is not asserted", () => {
    const trimmed = blocks.map((b) => (b.surface === "plugin" && Array.isArray(b.exports) ? { ...b, exports: b.exports.slice(0, -1) } : b));
    const extra: Facts = { ...facts, exports: { ...facts.exports, plugin: { ...facts.exports.plugin, values: new Set([...facts.exports.plugin.values, "AnAddition"]) } } };
    expect(checkContract(trimmed, extra)).toEqual([]);
  });

  it("033:FR-013, 033:SC-004: a listed flag, exit code, state file, printed line or export that is not true fails", () => {
    const bogus: ContractBlock[] = [
      { surface: "run", flags: ["--no-such-flag"], exitCodes: [7], stateFiles: [".amby/fleet/<run>/nothing.json"], printed: ["This line is never printed"] },
      { surface: "plugin", exports: ["NoSuchExport"], exportTypes: ["NoSuchType"], loadingRules: ["no-such-rule"], descriptor: ["targets[].nothing"] },
      { surface: "kit", exports: ["NoSuchKitExport"] },
    ];
    const failures = checkContract(bogus, facts).join("\n");
    for (const part of ["--no-such-flag", "exit code 7", "nothing.json", "This line is never printed", "NoSuchExport", "NoSuchType", "no-such-rule", "targets[].nothing", "NoSuchKitExport"]) {
      expect(failures, part).toContain(part);
    }
  });

  it("033:FR-013: a key in a block that nothing checks is a failure, so a promise cannot be added without a test", () => {
    const failures = checkContract([{ surface: "run", mystery: ["x"] }], facts);
    expect(failures).toEqual(["run: no check for the key 'mystery'"]);
  });

  it("033:FR-003: the document says that additions are allowed in a minor release and that unlisted things are not covered", () => {
    const text = readFileSync(DOC, "utf8");
    expect(text).toMatch(/additions? (are|is) allowed in a minor release/i);
    expect(text).toMatch(/not listed[^.]*(not covered|is not a breaking change)/i);
  });

  it("033:FR-001: the document lists something for `run`, for the plugin API and for the kit, and every `run` promise named in US-1 is there", () => {
    for (const surface of ["run", "plugin", "kit"]) {
      const c = contractFor(blocks, surface);
      const items = Object.entries(c).filter(([k, v]) => k !== "surface" && Array.isArray(v) && v.length > 0);
      expect(items.length, `the ${surface} surface lists nothing`).toBeGreaterThan(0);
    }
    // US-1: flags, exit codes, the printed plan and finish lines, the fleet state files and the directive protocol.
    const run = contractFor(blocks, "run");
    for (const key of ["flags", "exitCodes", "printed", "stateFiles", "directiveActions", "directiveFields"]) {
      expect((run[key] as unknown[] | undefined)?.length ?? 0, `run lists no ${key}`).toBeGreaterThan(0);
    }
    // US-1: the exported names, the descriptor shape, the loading rules and the kit.
    const plugin = contractFor(blocks, "plugin");
    for (const key of ["exports", "descriptor", "loadingRules"]) {
      expect((plugin[key] as unknown[] | undefined)?.length ?? 0, `plugin lists no ${key}`).toBeGreaterThan(0);
    }
    expect((contractFor(blocks, "kit")["exports"] as unknown[] | undefined)?.length ?? 0).toBeGreaterThan(0);
  });

  it("033:FR-013, 033:SC-004: removing a listed fact from the code side fails the check (a state file, a printed line, an export)", () => {
    const withoutState: Facts = { ...facts, stateFiles: new Set([...facts.stateFiles].filter((f) => !f.endsWith("budget.json"))) };
    expect(checkContract(blocks, withoutState).join("\n")).toContain("budget.json");
    expect(checkContract(blocks, { ...facts, runOutput: "" }).join("\n")).toContain("Run plan for");
    const noBase: Facts = { ...facts, exports: { ...facts.exports, plugin: { ...facts.exports.plugin, values: new Set([...facts.exports.plugin.values].filter((v) => v !== "BaseEmitter")) } } };
    expect(checkContract(blocks, noBase).join("\n")).toContain("BaseEmitter");
  });
});
