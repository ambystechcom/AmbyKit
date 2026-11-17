import { posix } from "node:path";
import { loadCommandSpecs } from "../core/command-spec.js";
import { escapesProject } from "../core/path-guard.js";
import type { CommandSpec, CommandSurface, EmittedFile, RulesContext } from "../core/types.js";
import type { TargetDef } from "../emitters/index.js";

/**
 * The contract test kit (feature 027, FR-009). It checks that an emitter writes what its host's
 * documentation says: the command paths and the leading frontmatter keys. The expectation is a
 * **matrix row**: data a plugin author records from the host's own docs (Principle 4). With no row the
 * check fails, so an undocumented target cannot pass.
 */

/** One host's documented command surface, as data. */
export interface MatrixRow {
  /** The target id the row describes. */
  target: string;
  commandSurface: CommandSurface;
  /** Directory that holds the command files, relative to the project root. */
  commandDir: string;
  /** Path of one command file under `commandDir`; `<phase>` is replaced by each phase id (`specify`, `plan`, …). */
  fileTemplate: string;
  /** The exact, ordered frontmatter keys of a command file: YAML `key:` lines or TOML `key =` lines. */
  frontmatterKeys: string[];
  /** Where the row was verified. */
  sourceUrl: string;
}

export interface ContractFailure {
  kind: "missing-row" | "invalid-row" | "target" | "surface" | "dir" | "emit-threw" | "escapes" | "missing-file" | "unexpected-file" | "frontmatter";
  message: string;
}

const SURFACES = new Set(["commands", "skills", "workflows", "none"]);

function rowProblems(row: unknown): string[] {
  if (!row || typeof row !== "object") return ["the row is not an object"];
  const r = row as Record<string, unknown>;
  const out: string[] = [];
  for (const k of ["target", "commandDir", "fileTemplate", "sourceUrl"] as const) {
    if (typeof r[k] !== "string" || r[k] === "") out.push(`${k} must be a non-empty string`);
  }
  if (typeof r["commandSurface"] !== "string" || !SURFACES.has(r["commandSurface"])) out.push(`commandSurface must be one of ${[...SURFACES].join(", ")}`);
  if (!Array.isArray(r["frontmatterKeys"]) || !r["frontmatterKeys"].every((k) => typeof k === "string")) out.push("frontmatterKeys must be an array of strings");
  return out;
}

const norm = (p: string): string => posix.normalize(p.replaceAll("\\", "/")).replace(/^\.\//, "").replace(/\/$/, "");

/** The leading frontmatter keys of a command file, in order. YAML (`---` block) or TOML (top-level `key =`). */
export function frontmatterKeys(path: string, contents: string): string[] {
  const lines = contents.replaceAll("\r\n", "\n").split("\n");
  if (path.endsWith(".toml")) {
    const keys: string[] = [];
    let open: string | null = null;
    for (const line of lines) {
      if (open) {
        if (line.includes(open)) open = null;
        continue;
      }
      const m = /^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      keys.push(m[1]!);
      const value = m[2]!;
      const delim = value.startsWith("'''") ? "'''" : value.startsWith('"""') ? '"""' : null;
      if (delim && !value.slice(3).includes(delim)) open = delim;
    }
    return keys;
  }
  if (lines[0]?.trim() !== "---") return [];
  const keys: string[] = [];
  for (const line of lines.slice(1)) {
    if (line.trim() === "---") return keys;
    const m = /^([A-Za-z0-9_-]+):/.exec(line);
    if (m) keys.push(m[1]!);
  }
  return keys;
}

/**
 * Compare an emitter's output with a matrix row. Returns every difference (empty = the contract holds).
 * `specs` defaults to the shipped phase prompts.
 */
export function checkEmitterContract(target: TargetDef, row: MatrixRow | null | undefined, specs: CommandSpec[] = loadCommandSpecs()): ContractFailure[] {
  if (row === null || row === undefined) {
    return [{ kind: "missing-row", message: `No matrix row for target '${target.id}'. Record the host's documented paths and frontmatter keys as a row before the contract can be checked.` }];
  }
  const bad = rowProblems(row);
  if (bad.length > 0) return [{ kind: "invalid-row", message: `The matrix row is invalid: ${bad.join("; ")}.` }];

  const failures: ContractFailure[] = [];
  const emitter = target.emitter;
  if (row.target !== target.id) failures.push({ kind: "target", message: `The row is for target '${row.target}', but the target is '${target.id}'.` });
  if (row.commandSurface !== emitter.commandSurface) {
    failures.push({ kind: "surface", message: `commandSurface is '${emitter.commandSurface}', the row says '${row.commandSurface}'.` });
  }
  if (norm(row.commandDir) !== norm(emitter.commandDir)) {
    failures.push({ kind: "dir", message: `commandDir is '${emitter.commandDir}', the row says '${row.commandDir}'.` });
  }

  let files: EmittedFile[];
  try {
    const ctx: RulesContext = { projectName: "contract-kit", specs, manageRules: false };
    files = emitter.emit(specs, ctx);
  } catch (err) {
    return [...failures, { kind: "emit-threw", message: `emit() threw: ${err instanceof Error ? err.message : String(err)}` }];
  }

  for (const f of files) {
    if (f.scope === "project" && escapesProject(f.path)) failures.push({ kind: "escapes", message: `'${f.path}' is outside the project.` });
  }

  const expected = row.commandSurface === "none" ? [] : specs.map((s) => posix.join(norm(row.commandDir), row.fileTemplate.replaceAll("<phase>", s.id)));
  const emitted = new Set(files.map((f) => norm(f.path)));
  for (const path of expected) {
    if (!emitted.has(norm(path))) failures.push({ kind: "missing-file", message: `Expected file '${path}' (from the row's fileTemplate) was not emitted.` });
  }
  const expectedSet = new Set(expected.map(norm));
  for (const f of files) {
    if (!expectedSet.has(norm(f.path))) failures.push({ kind: "unexpected-file", message: `Emitted '${f.path}', which the row does not describe.` });
  }

  const groups = new Map<string, string[]>();
  for (const f of files) {
    if (!expectedSet.has(norm(f.path))) continue;
    const actual = frontmatterKeys(f.path, f.contents);
    if (actual.join("\0") === row.frontmatterKeys.join("\0")) continue;
    const label = JSON.stringify(actual);
    groups.set(label, [...(groups.get(label) ?? []), f.path]);
  }
  for (const [actual, paths] of groups) {
    failures.push({
      kind: "frontmatter",
      message: `${paths.length} command file(s) (e.g. '${paths[0]}') have frontmatter keys ${actual}, the row says ${JSON.stringify(row.frontmatterKeys)}.`,
    });
  }
  return failures;
}
