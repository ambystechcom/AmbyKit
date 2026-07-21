import { buildRegion, REGION_HEADING } from "./merge.js";
import type { CommandSpec } from "./types.js";

/**
 * Build the AmbyKit-owned **region** (feature 008): a `### AmbyKit usage` section carrying the
 * workflow command list and agent rules, plus a fingerprint footer. Authored once here (Principle 1)
 * and reused by every rules file — the shared AGENTS.md and each tool's rules file splice this same
 * region into an existing document, preserving the user's own content around it (FR-001/003/006).
 */
export function buildAmbyRegion(specs: CommandSpec[]): string {
  const rows = specs
    .slice()
    .sort((a, b) => phaseOrder(a.phase) - phaseOrder(b.phase))
    .map((s) => `| \`/${s.name}\` | ${s.description} |`)
    .join("\n");

  const core = `${REGION_HEADING}

This project uses **AmbyKit** for Spec-Driven Development. Build features by producing structured
artifacts before code: a constitution, specs (user stories + EARS requirements), UI design, a plan,
and an ordered task list.

**Workflow commands**

| Command | Purpose |
|---|---|
${rows}

**Rules for agents**

- Read \`.amby/constitution.md\` and honor its principles in every phase.
- Specs (\`specs/NNN-*/spec.md\`) capture WHAT/WHY with **no technology choices**; plans capture HOW.
- Requirements use EARS (WHEN/WHILE/IF…THE SYSTEM SHALL…) with Given/When/Then acceptance criteria.
- Reference artifacts by stable id (US-#, FR-###, SC-###); don't restate them. Patch in place.
- Task checkboxes in \`tasks.md\` are the source of truth for progress (\`ambykit dashboard\`).`;

  return buildRegion(core);
}

/**
 * Build a short `### AmbyKit usage` **pointer** region for a per-tool rules file. Unlike the full
 * region (which carries the workflow table), pointer regions defer to `AGENTS.md` and just note where
 * the `/amby.*` commands live — `commandNote` supplies that tool-specific sentence.
 */
export function buildPointerRegion(commandNote: string): string {
  const core = `${REGION_HEADING}

This project uses **AmbyKit** for Spec-Driven Development. Follow the workflow and rules in
\`AGENTS.md\`. ${commandNote}`;
  return buildRegion(core);
}

/**
 * Build the shared, tool-neutral AGENTS.md for a consumer project. Natively read by OpenCode,
 * Copilot, Cursor, and Antigravity; Claude Code reads it via a CLAUDE.md `@AGENTS.md` bridge.
 * The AmbyKit body is the region from `buildAmbyRegion`, under a project title.
 */
export function buildAgentsMd(projectName: string, specs: CommandSpec[]): string {
  return `# AGENTS.md — ${projectName}

${buildAmbyRegion(specs)}`;
}

const PHASE_SEQUENCE = [
  "constitution",
  "specify",
  "clarify",
  "revise",
  "design",
  "plan",
  "tasks",
  "analyze",
  "implement",
];

function phaseOrder(phase: string): number {
  const i = PHASE_SEQUENCE.indexOf(phase);
  return i === -1 ? PHASE_SEQUENCE.length : i;
}
