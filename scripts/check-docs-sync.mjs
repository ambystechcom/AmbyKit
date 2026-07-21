#!/usr/bin/env node
/**
 * FR-014 docs-sync check (feature 007). Fails (exit 1) when the docs' workflow/command *facts* drift
 * from the AmbyKit source of truth. Prose is not checked; the invariants in
 * specs/007-documentation-site/contracts/docs-sync.md (A1–A9) are. Run from the repo root:
 *   node scripts/check-docs-sync.mjs
 *
 * A1–A5 cover the Astro site's per-phase pages, CLI reference, and compatibility table. A6–A9 cover
 * the surfaces that a phase/verb can be *silently absent from*: the repo README (what npm renders),
 * the `docs/` tree, the workflow overview page (whose diagram and cards are hand-maintained, so a
 * page can exist and still be unreachable), and the AGENTS.md structure map that agents orient from.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROMPTS = join(root, "src/prompts");
const WORKFLOW = join(root, "site/src/content/docs/workflow");
const CLI_REF = join(root, "site/src/content/docs/cli/index.mdx");
const COMPAT = join(root, "site/src/content/docs/cli/compatibility.mdx");
const WF_INDEX = join(WORKFLOW, "index.mdx");
const README = join(root, "README.md");
const DOCS_WORKFLOW = join(root, "docs/workflow.md");
const DOCS_CLI_REF = join(root, "docs/cli-reference.md");
const AGENTS = join(root, "AGENTS.md");

const errors = [];
const fail = (assertion, msg) => errors.push(`[${assertion}] ${msg}`);
const eqArr = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

// --- source of truth: CommandSpecs from src/prompts ---
const specs = readdirSync(PROMPTS)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const { data } = matter(readFileSync(join(PROMPTS, f), "utf8"));
    return { id: data.id, name: data.name, reads: data.reads ?? [], writes: data.writes ?? [] };
  });
const specById = new Map(specs.map((s) => [s.id, s]));

// --- source of truth: CLI verbs (BaseCommand subclasses) ---
const verbs = new Set();
for (const f of readdirSync(join(root, "src/cli"))) {
  if (!f.endsWith(".ts")) continue;
  const src = readFileSync(join(root, "src/cli", f), "utf8");
  // Match `[override] readonly name[: string] = "verb"` and any *Command base (e.g. a deprecated alias
  // that extends another command, not BaseCommand directly).
  const m = src.match(/(?:override\s+)?readonly name(?:\s*:\s*string)?\s*=\s*"([a-z-]+)"/);
  if (m && /\bextends \w*Command\b/.test(src)) verbs.add(m[1]);
}

// --- source of truth: emitter/target registry ---
const emitterSrc = readFileSync(join(root, "src/emitters/index.ts"), "utf8");
const targetsBlock = emitterSrc.match(/TARGETS[^[]*\[([\s\S]*?)\];/)?.[1] ?? "";
const nonAliasTargets = targetsBlock
  .split("\n")
  .map((line) => ({ id: line.match(/id:\s*"([^"]+)"/)?.[1], alias: /alias:\s*true/.test(line) }))
  .filter((t) => t.id && !t.alias)
  .map((t) => t.id);

// --- site facts: phase pages ---
const pages = readdirSync(WORKFLOW)
  .filter((f) => f.endsWith(".mdx") && f !== "index.mdx")
  .map((f) => ({ file: f, ...matter(readFileSync(join(WORKFLOW, f), "utf8")).data }));

// A1 — every CommandSpec id has exactly one page; no page references an unknown id.
for (const s of specs) {
  const n = pages.filter((p) => p.phase === s.id).length;
  if (n !== 1) fail("A1", `phase '${s.id}' should have exactly one page (found ${n})`);
}
for (const p of pages) {
  if (!specById.has(p.phase)) fail("A1", `${p.file} references unknown phase '${p.phase}'`);
}

// A2 — command / reads / writes match the CommandSpec.
for (const p of pages) {
  const s = specById.get(p.phase);
  if (!s) continue;
  if (p.command !== s.name) fail("A2", `${p.file}: command '${p.command}' != '${s.name}'`);
  if (!eqArr(p.reads, s.reads)) fail("A2", `${p.file}: reads drift (page ${JSON.stringify(p.reads)} vs source ${JSON.stringify(s.reads)})`);
  if (!eqArr(p.writes, s.writes)) fail("A2", `${p.file}: writes drift (page ${JSON.stringify(p.writes)} vs source ${JSON.stringify(s.writes)})`);
}

// A3 — order values form a contiguous 1..N sequence.
const orders = pages.map((p) => p.order).sort((a, b) => a - b);
orders.forEach((o, i) => {
  if (o !== i + 1) fail("A3", `order not contiguous: expected ${i + 1}, found ${o}`);
});

// A4 — the CLI reference lists every verb.
const ref = readFileSync(CLI_REF, "utf8");
for (const v of verbs) if (!ref.includes(`ambykit ${v}`)) fail("A4", `CLI reference missing verb '${v}'`);

// A5 — the compatibility page lists every non-alias target.
const compat = readFileSync(COMPAT, "utf8");
for (const id of nonAliasTargets) if (!compat.includes(id)) fail("A5", `compatibility page missing target '${id}'`);

// A6 — the README and docs/workflow.md each name every phase command.
for (const [label, file] of [["README.md", README], ["docs/workflow.md", DOCS_WORKFLOW]]) {
  const txt = readFileSync(file, "utf8");
  for (const s of specs) if (!txt.includes(`/${s.name}`)) fail("A6", `${label} never mentions '/${s.name}'`);
}

// A7 — the README and docs/cli-reference.md each name every CLI verb.
for (const [label, file] of [["README.md", README], ["docs/cli-reference.md", DOCS_CLI_REF]]) {
  const txt = readFileSync(file, "utf8");
  for (const v of verbs) if (!txt.includes(`ambykit ${v}`)) fail("A7", `${label} never mentions verb 'ambykit ${v}'`);
}

// A8 — the workflow overview reaches every phase: a LinkCard, plus the hand-written Mermaid diagram
// and its a11y summary. Without this a phase page can exist yet be unreachable from the overview.
const wfIndex = readFileSync(WF_INDEX, "utf8");
const diagram = wfIndex.match(/code=\{`([\s\S]*?)`\}/)?.[1] ?? "";
const summary = wfIndex.match(/summary="([^"]*)"/)?.[1] ?? "";
if (!diagram) fail("A8", "workflow overview: could not find the Diagram `code={`…`}` block");
if (!summary) fail("A8", "workflow overview: could not find the Diagram `summary=\"…\"` prop");
for (const s of specs) {
  if (!wfIndex.includes(`/workflow/${s.id}/`)) fail("A8", `workflow overview has no card linking /workflow/${s.id}/`);
  if (diagram && !diagram.includes(s.id)) fail("A8", `workflow diagram omits phase '${s.id}'`);
  if (summary && !summary.includes(s.id)) fail("A8", `workflow diagram summary omits phase '${s.id}'`);
}

// A9 — the AGENTS.md structure map lists exactly the real CLI verbs (catches renamed/dropped verbs).
const cliLine = readFileSync(AGENTS, "utf8").split("\n").find((l) => l.startsWith("src/cli/")) ?? "";
const listed = cliLine.match(/BaseCommand \+ ([a-z/]+) \+ registry/)?.[1];
if (!listed) {
  fail("A9", "AGENTS.md `src/cli/` line: expected 'BaseCommand + <verb>/<verb>/… + registry'");
} else {
  const named = new Set(listed.split("/").filter(Boolean));
  for (const v of verbs) if (!named.has(v)) fail("A9", `AGENTS.md \`src/cli/\` line missing verb '${v}'`);
  for (const v of named) if (!verbs.has(v)) fail("A9", `AGENTS.md \`src/cli/\` line names non-existent verb '${v}'`);
}

if (errors.length > 0) {
  console.error("✗ docs out of sync:\n" + errors.map((e) => "  " + e).join("\n"));
  process.exit(1);
}
console.log(`✓ docs in sync (${specs.length} phases, ${verbs.size} verbs, ${nonAliasTargets.length} targets)`);
