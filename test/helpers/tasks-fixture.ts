/**
 * Builder for `tasks.md` bodies (feature 015 fixture). Covers what the lane parser must handle:
 * `## Phase N` headings, `[P]`, single/multi/no/glob paths, and checked lines.
 */

export interface TaskDef {
  id: string;
  /** Story number → `[US#]` tag; omit for Setup/Polish-style tasks. */
  story?: number;
  parallel?: boolean;
  done?: boolean;
  description?: string;
  /**
   * Trailing path group: `string[]` → `(a, b)`; `string` → `(raw)` verbatim (e.g. a glob or a
   * prose parenthetical); `null`/omitted → no group at all.
   */
  paths?: string[] | string | null;
}

export interface PhaseDef {
  /** Heading text after `## ` — e.g. `Phase 3 — User story US-1`. Omit for tasks before any heading. */
  heading?: string;
  tasks: TaskDef[];
}

export function taskLine(t: TaskDef): string {
  const tags = [`[${t.id}]`];
  if (t.parallel) tags.push("[P]");
  if (t.story !== undefined) tags.push(`[US${t.story}]`);
  const group =
    t.paths === undefined || t.paths === null
      ? ""
      : ` (${Array.isArray(t.paths) ? t.paths.join(", ") : t.paths})`;
  return `- [${t.done ? "x" : " "}] ${tags.join(" ")} ${t.description ?? `task ${t.id}`}${group}`;
}

/** Build a `tasks.md` body. `eol` lets tests exercise CRLF files. */
export function tasksMd(phases: PhaseDef[], opts: { eol?: "\n" | "\r\n"; feature?: string } = {}): string {
  const eol = opts.eol ?? "\n";
  const out: string[] = [`---`, `feature: ${opts.feature ?? "015-parallel-lanes"}`, `---`, ``, `# Tasks`, ``];
  for (const p of phases) {
    if (p.heading) out.push(`## ${p.heading}`, ``);
    for (const t of p.tasks) out.push(taskLine(t));
    out.push(``);
  }
  return out.join(eol);
}

/** Shorthand: a single numbered phase, e.g. `phase(3, [...])` → `## Phase 3`. */
export function phase(n: number, tasks: TaskDef[]): PhaseDef {
  return { heading: `Phase ${n}`, tasks };
}
