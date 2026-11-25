#!/usr/bin/env node
/**
 * The 2.0 release gate (spec 034, FR-003, FR-004, FR-009). Reads `specs/034-release-2-0/gate.md` and stops the release at the first of
 * the five conditions (C1 to C5) that is not `met` with a date and evidence. It also checks the preconditions that are not gate
 * conditions (034 decision D-2): the Antigravity plugin is published and install-tested (036 T034, T035, T037 ticked, and the package is
 * on npm) and, for a final version, `specs/034-release-2-0/rc-report.md` records a project other than this repository and a date.
 *
 *   node scripts/release-gate.mjs [--version <x.y.z>] [--offline]
 *
 * The gate applies to the final 2.0.x versions only: a release candidate (`2.0.0-rc.1`) is cut before the gate is finished, and a
 * 1.x patch has no 2.0 gate. `npm run release:check` asks for 2.0.0 explicitly; `publish.yml` passes the package version.
 * On failure it prints the first unmet item, then the rest, and exits 1. `--offline` skips the npm lookup with a warning.
 * The pure functions are exported for `test/release/release-gate.test.ts`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseVersion } from "./release-tag.mjs";

export const GATE_FILE = "specs/034-release-2-0/gate.md";
export const RC_REPORT_FILE = "specs/034-release-2-0/rc-report.md";
export const PLUGIN_PACKAGE = "@ambystech/ambykit-emitter-antigravity";
/** 036 tasks that must be ticked before 2.0: plugin published (T034), install-tested (T035), trusted publisher added (T037). */
export const PLUGIN_TASKS = ["T034", "T035", "T037"];
/** Exactly the five conditions of US-2, in order. */
export const CONDITIONS = ["C1", "C2", "C3", "C4", "C5"];
const RESULTS = new Set(["met", "not met", "pending"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for 2.0.0, 2.0.1, …: the versions this gate guards. A prerelease or any other line is not gated. */
export function gateApplies(version) {
  const v = parseVersion(version);
  return v !== null && v.prerelease === null && v.major === 2 && v.minor === 0;
}

/** Rows of the gate table: `{ id, condition, result, date, evidence }`, in file order. Rows whose first cell is not `C<n>` are ignored. */
export function parseGate(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trimStart().startsWith("|")) continue;
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (!/^C\d+$/.test(cells[0] ?? "")) continue;
    const [id, condition = "", result = "", date = "", ...rest] = cells;
    rows.push({ id, condition, result: result.toLowerCase(), date, evidence: rest.join("|").trim() });
  }
  return rows;
}

/** Problems with the table, in condition order: a missing, extra or repeated condition, then each row that is not `met` with a date and evidence. */
export function gateProblems(rows) {
  const problems = [];
  const ids = rows.map((r) => r.id);
  for (const id of CONDITIONS) if (!ids.includes(id)) problems.push(`${id} is missing from the gate`);
  for (const id of ids) if (!CONDITIONS.includes(id)) problems.push(`${id} is not one of the five gate conditions (C1 to C5)`);
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) problems.push(`${id} appears more than once in the gate`);
  for (const id of CONDITIONS) {
    const row = rows.find((r) => r.id === id);
    if (!row) continue;
    const name = `${id} (${row.condition})`;
    if (!RESULTS.has(row.result)) problems.push(`${name}: result '${row.result}' is not met, not met or pending`);
    else if (row.result !== "met") problems.push(`${name} is ${row.result}${row.evidence ? `: ${row.evidence}` : ""}`);
    else if (!DATE.test(row.date)) problems.push(`${name} is met but has no date (YYYY-MM-DD)`);
    else if (row.evidence === "") problems.push(`${name} is met but records no evidence`);
  }
  return problems;
}

/** The 036 plugin tasks that are not ticked in 036's tasks.md. */
export function pluginTaskProblems(tasksText) {
  if (tasksText === undefined) return ["specs/036-core-and-plugin-targets/tasks.md was not found"];
  const problems = [];
  for (const id of PLUGIN_TASKS) {
    const m = new RegExp(`^\\s*- \\[( |x|X)\\] \\[${id}\\]`, "m").exec(tasksText);
    if (!m) problems.push(`036 ${id} is not in 036's tasks.md`);
    else if (m[1] === " ") problems.push(`036 ${id} is not done (Antigravity plugin published, install-tested and trusted publisher added)`);
  }
  return problems;
}

/**
 * What `rc-report.md` lacks for a final release (FR-009): a `- **Project:**` line naming a project other than this repository and a
 * `- **Date:**` line. `undefined` text means the file does not exist.
 */
export function rcReportProblems(text) {
  if (text === undefined) return [`${RC_REPORT_FILE} does not exist: try the release candidate on another project first (034 T052)`];
  const field = (label) => new RegExp(`^\\s*[-*]\\s*\\*\\*${label}:\\*\\*[ \\t]*(.*)$`, "mi").exec(text)?.[1]?.trim() ?? "";
  const problems = [];
  const project = field("Project");
  if (project === "") problems.push(`${RC_REPORT_FILE} names no project (- **Project:** …)`);
  else if (/^(?:(?:https?:\/\/github\.com\/)?ambystechcom\/)?ambykit(?:\.git)?$|^this repo(?:sitory)?$/i.test(project)) problems.push(`${RC_REPORT_FILE} names '${project}': the candidate must be tried on a project other than this repository`);
  if (!DATE.test(field("Date"))) problems.push(`${RC_REPORT_FILE} records no date (- **Date:** YYYY-MM-DD)`);
  return problems;
}

/**
 * Whether the plugin is on npm, from an `npm view <pkg> version` result `{ status, stdout, stderr, error }`:
 * `{ problem }` when npm says it does not exist, `{ warning }` when npm could not be asked, `{}` when it is published.
 */
export function npmViewOutcome(result) {
  if (result.error || result.status === null) return { warning: `could not run npm to check ${PLUGIN_PACKAGE} is published; check it by hand` };
  if (result.status === 0 && String(result.stdout).trim() !== "") return {};
  if (/E404|404 Not Found|is not in this registry/i.test(String(result.stderr))) return { problem: `${PLUGIN_PACKAGE} is not published on npm (036 T034)` };
  return { warning: `npm could not confirm ${PLUGIN_PACKAGE} is published (${String(result.stderr).trim().split(/\r?\n/)[0] || `exit ${result.status}`}); check it by hand` };
}

/**
 * Everything that blocks releasing `version`: `{ applies, problems, warnings }`. `read(path)` returns a repository file's text or
 * undefined; `npmView()` returns the `npm view` result, or is null when offline. Pure apart from the two callbacks.
 */
export function checkRelease({ version, read, npmView }) {
  if (!gateApplies(version)) return { applies: false, problems: [], warnings: [] };
  const problems = [];
  const warnings = [];
  const gate = read(GATE_FILE);
  if (gate === undefined) problems.push(`${GATE_FILE} does not exist`);
  else problems.push(...gateProblems(parseGate(gate)));
  problems.push(...pluginTaskProblems(read("036-tasks")));
  if (npmView === null) warnings.push(`offline: did not check ${PLUGIN_PACKAGE} is published on npm`);
  else {
    const o = npmViewOutcome(npmView());
    if (o.problem) problems.push(o.problem);
    if (o.warning) warnings.push(o.warning);
  }
  problems.push(...rcReportProblems(read(RC_REPORT_FILE)));
  return { applies: true, problems, warnings };
}

function readRepoFile(root, path) {
  if (path === "036-tasks") {
    const dir = readdirSync(join(root, "specs")).find((d) => d.startsWith("036-"));
    path = dir ? `specs/${dir}/tasks.md` : "specs/036-missing/tasks.md";
  }
  const file = join(root, path);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

function main(argv) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const at = argv.indexOf("--version");
  const version = at >= 0 ? argv[at + 1] : JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  if (!parseVersion(version)) {
    console.log(`::error::'${version}' is not a version like 2.0.0`);
    return 2;
  }
  const npmView = argv.includes("--offline")
    ? null
    : () => spawnSync("npm", ["view", PLUGIN_PACKAGE, "version"], { encoding: "utf8", shell: process.platform === "win32", timeout: 30_000 });
  const r = checkRelease({ version, read: (p) => readRepoFile(root, p), npmView });
  for (const w of r.warnings) console.log(`::warning::${w}`);
  if (!r.applies) {
    console.log(`release gate: ${version} is not a final 2.0.x version; no gate applies`);
    return 0;
  }
  if (r.problems.length > 0) {
    console.log(`::error::release gate for ${version} stops at: ${r.problems[0]}`);
    for (const p of r.problems.slice(1)) console.log(`  also: ${p}`);
    return 1;
  }
  console.log(`release gate for ${version}: C1 to C5 met, Antigravity plugin published, candidate report recorded`);
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exit(main(process.argv.slice(2)));
}
