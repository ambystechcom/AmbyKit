/**
 * Prompts for headless jobs (feature 028, FR-004, Principle 3). A lane's prompt carries only what the
 * assistant cannot get cheaper elsewhere: its task IDs, the artifacts by `@path` reference, and the files it
 * owns. Task text, the spec and the plan are never copied in: the assistant reads them by reference.
 */

export interface PromptLane {
  feature: string;
  /** Full lane name `NNN-slug.lane-p-k`. */
  lane: string;
  phase: number;
  tasks: { id: string; paths: string[] }[];
}

export interface LanePromptOptions {
  /** Run id, so reports and directives name it. */
  run: string;
  /** `@` reference targets that exist, relative to the lane checkout (spec, plan, tasks, tests). */
  artifacts: string[];
  /** Task IDs still unchecked; checked ones are not listed (a restart repeats no completed task). */
  open?: string[];
  /** Review finding IDs returned to the worker; when present the prompt is a fix round, not a build. */
  findings?: string[];
  /** The protocol wording shared with spec 019's worker persona (reporting cadence and directive text). */
  protocol?: string;
  /** The run directory relative to the project root; `.amby/fleet/<run>` for a single run, nested in a fleet's directory for a fleet's (feature 031). */
  runDir?: string;
}

export const shortName = (lane: string): string => lane.slice(lane.lastIndexOf(".lane-") + 1);

export function buildLanePrompt(lane: PromptLane, opts: LanePromptOptions): string {
  const open = opts.open ?? lane.tasks.map((t) => t.id);
  const refs = opts.artifacts.map((a) => `@${a}`).join(" ");
  const own = [...new Set(lane.tasks.filter((t) => open.includes(t.id)).flatMap((t) => t.paths))];
  const name = shortName(lane.lane);
  const lines: string[] = [];
  if (opts.findings && opts.findings.length > 0) {
    lines.push(`You are the worker of lane ${name} of ${lane.feature} (run ${opts.run}). Fix exactly these review findings and nothing else: ${opts.findings.join(", ")}.`);
    lines.push(`Read: ${refs}. The findings are in the verdict files under ${opts.runDir ?? `.amby/fleet/${opts.run}`}/verdicts/. Report one line per ID: <id>: fixed (<files>).`);
  } else {
    lines.push(
      `You are the worker of lane ${name} of ${lane.feature} (run ${opts.run}), phase ${lane.phase}. Build only these tasks, in order, and check each off in tasks.md: ${open.join(", ") || "(none left)"}.`,
    );
    lines.push(`Read: ${refs}.`);
  }
  if (own.length > 0) lines.push(`Edit only the files you own: ${own.join(", ")}.`);
  lines.push(
    `Report: ambykit activity ${lane.feature} --phase=implement --task=T### --lane=${name} --state=<working|waiting|blocked|done> --run=${opts.run}; then read your directive with: ambykit fleet directive ${lane.feature} ${name} --run=${opts.run}.`,
  );
  if (opts.protocol) lines.push(opts.protocol);
  return lines.join("\n");
}

export type ReviewRole = "qa" | "architect";

export interface RolePromptInput {
  role: ReviewRole;
  feature: string;
  lane: string;
  phase: number;
  round: number;
  run: string;
  /** The role file by reference, e.g. `.amby/roles/qa.md`. */
  roleFile: string;
  /** The phase's `**Verify:**` line, verbatim; absent when the phase has none. */
  verify?: string;
  artifacts: string[];
  /** The verdict file the role writes, relative to the run directory. */
  verdictFile: string;
  /** The run directory relative to the project root (default `.amby/fleet/<run>`); a fleet's runs are nested (feature 031). */
  runDir?: string;
}

/** QA and architect jobs: the role by `@` reference, the phase's Verify line, and where to write the verdict. */
export function buildRolePrompt(input: RolePromptInput): string {
  const refs = input.artifacts.map((a) => `@${a}`).join(" ");
  return [
    `Act as the ${input.role} reviewer: follow @${input.roleFile}. Review lane ${shortName(input.lane)} of ${input.feature}, phase ${input.phase}, round ${input.round}. Read: ${refs}.`,
    input.verify ? `Run this check and judge its result: ${input.verify}` : "The phase has no Verify line: review the lane's diff against the plan.",
    `Write your verdict to ${input.runDir ?? `.amby/fleet/${input.run}`}/${input.verdictFile} as JSON: {"verdict":"pass"|"fail","findings":[{"id","severity","finding","fix"}]}. A fail needs at least one finding with an id. Edit no other file.`,
  ].join("\n");
}
