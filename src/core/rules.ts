import type { CommandSpec } from "./types.js";

/**
 * Build the shared, tool-neutral AGENTS.md for a consumer project. Natively read by OpenCode,
 * Copilot, Cursor, and Antigravity; Claude Code reads it via a CLAUDE.md `@AGENTS.md` bridge.
 */
export function buildAgentsMd(projectName: string, specs: CommandSpec[]): string {
  const rows = specs
    .slice()
    .sort((a, b) => phaseOrder(a.phase) - phaseOrder(b.phase))
    .map((s) => `| \`/${s.name}\` | ${s.description} |`)
    .join("\n");

  return `# AGENTS.md — ${projectName}

This project uses **AmbyKit** for Spec-Driven Development. Build features by producing structured
artifacts before code: a constitution, specs (user stories + EARS requirements), UI design, a plan,
and an ordered task list.

## Workflow commands

| Command | Purpose |
|---|---|
${rows}

## Rules for agents

- Read \`.amby/constitution.md\` and honor its principles in every phase.
- Specs (\`specs/NNN-*/spec.md\`) capture WHAT/WHY with **no technology choices**; plans capture HOW.
- Requirements use EARS (WHEN/WHILE/IF…THE SYSTEM SHALL…) with Given/When/Then acceptance criteria.
- Reference artifacts by stable id (US-#, FR-###, SC-###); don't restate them. Patch in place.
- Task checkboxes in \`tasks.md\` are the source of truth for progress (\`ambykit dashboard\`).

<!-- Managed by AmbyKit. Regenerate with \`ambykit sync\`. -->
`;
}

const PHASE_SEQUENCE = [
  "constitution",
  "specify",
  "clarify",
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
