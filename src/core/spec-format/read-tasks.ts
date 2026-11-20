// v2 task reader (030:FR-002, FR-003). Per-phase fenced yaml blocks (and the per-task layout) carry `files` and `verify`;
// everything else stays markdown, and BLOCKED / DEVIATION markers stay on the task line (026:D-5). Returns the same
// `TaskLine` and `PhaseVerify` the 1.x parsers return.
import { parseDeclaredPaths, parseTasks, type TaskLine } from "../dashboard.js";
import { parsePhases, type PhaseVerify } from "../markers.js";
import { scanBlocks } from "./blocks.js";
import { parseYaml } from "./frontmatter.js";
import type { FormatIssue, TasksRead } from "./model.js";

const RESULTS = ["passed", "failed", "unverified"] as const;

/** Strip the trailing declared-path group from a description (ownership is not prose). */
function stripGroup(desc: string): string {
  return desc.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

export function readTasksV2(text: string, file: string, marker: boolean): TasksRead {
  const issues: FormatIssue[] = [];
  const err = (line: number, kind: string, message: string): void => void issues.push({ file, line, severity: "error", kind, message });
  const warn = (line: number, kind: string, message: string): void => void issues.push({ file, line, severity: "warning", kind, message });
  if (!marker) warn(1, "missing-format-marker", "yaml blocks found without `format: 2` in the frontmatter; read as format 2 (add the marker)");

  const tasks: TaskLine[] = parseTasks(text);
  const phases: PhaseVerify[] = parsePhases(text);
  const byId = new Map<string, TaskLine[]>();
  for (const t of tasks) byId.set(t.id, [...(byId.get(t.id) ?? []), t]);

  const assigned = new Set<TaskLine>();
  const filesSeen = new Set<number>();
  const verifySeen = new Set<number>();
  const applyFiles = (t: TaskLine, items: unknown, line: number): void => {
    if (!Array.isArray(items) || items.some((x) => typeof x !== "string")) {
      err(line, "bad-files", `${t.id}: files must be a list of strings`);
      return;
    }
    assigned.add(t);
    const declared = parseDeclaredPaths(`(${(items as string[]).join(", ")})`);
    const same = t.paths.join() === declared.paths.join() && t.pathIssue === declared.pathIssue;
    if (t.paths.length > 0 && !same) warn(line, "trailing-group-disagrees", `${t.id}: trailing group on the line disagrees with the block; block wins`);
    t.paths = declared.paths;
    if (declared.pathIssue) t.pathIssue = declared.pathIssue;
    else delete t.pathIssue;
    // dual-write: the line still carries the same group, so it is not prose; otherwise the line is prose as written
    if (same) t.description = stripGroup(t.description);
  };

  for (const b of scanBlocks(text).blocks) {
    if (!b.ours) continue; // foreign yaml (documentation examples) is ignored (026:D-10)
    if (b.unclosed) {
      err(b.start, "block-unclosed", "fenced yaml block is not closed");
      continue;
    }
    const data = parseYaml(b.src, b.start + 1, "tasks block", file, issues);
    if (data === undefined) continue;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      err(b.start, "block-not-mapping", "block must be a mapping with files and/or verify");
      continue;
    }
    const d = data as Record<string, unknown>;
    for (const k of Object.keys(d)) {
      if (k !== "files" && k !== "verify") err(b.start, "unknown-key", `unknown key \`${k}\` in tasks block (allowed: files, verify)`);
    }
    const ph = phases[b.ordinal - 1];
    const files = d["files"];
    if (files !== undefined) {
      if (Array.isArray(files)) {
        // task-scoped block: files only, attached to the task line it directly follows
        if ("verify" in d) err(b.start, "task-block-verify", "a task block carries files only; verify belongs to the phase block");
        const cands = b.followsTask ? (byId.get(b.followsTask) ?? []) : [];
        const t = cands.find((c) => c.phase === ph?.phase) ?? cands[cands.length - 1];
        if (!t) err(b.start, "detached-block", "a task block must directly follow a task line");
        else applyFiles(t, files, b.start);
      } else if (files && typeof files === "object") {
        // phase-scoped block: files maps T-id to a list
        for (const [id, items] of Object.entries(files as Record<string, unknown>)) {
          const inPhase = (byId.get(id) ?? []).filter((c) => c.phase === ph?.phase);
          if (inPhase.length === 0) {
            err(b.start, "unknown-task", `files lists ${id}, which is not a task of this phase`);
            continue;
          }
          if (inPhase.length > 1) {
            err(b.start, "ambiguous-task", `${id} is ambiguous: defined ${inPhase.length} times in this phase`);
            continue;
          }
          applyFiles(inPhase[0] as TaskLine, items, b.start);
        }
        if (filesSeen.has(b.ordinal)) warn(b.start, "second-files-block", "second ownership block in one phase");
        filesSeen.add(b.ordinal);
      } else {
        err(b.start, "bad-files", "`files` must be a mapping (phase block) or a list (task block)");
      }
    }
    const verify = d["verify"];
    if (verify !== undefined) {
      if (!ph) {
        err(b.start, "verify-outside-phase", "verify block outside any phase");
        continue;
      }
      const v = verify as Record<string, unknown> | null;
      if (!v || typeof v !== "object" || typeof v["check"] !== "string") {
        err(b.start, "verify-needs-check", "verify needs a `check` string");
        continue;
      }
      const result = v["result"];
      if (result !== undefined && !(RESULTS as readonly unknown[]).includes(result)) {
        err(b.start, "bad-result", `verify.result must be passed|failed|unverified, got ${JSON.stringify(result)}`);
        continue;
      }
      if (verifySeen.has(b.ordinal)) {
        err(b.start, "duplicate-verify", "more than one verify block in a phase");
        continue;
      }
      verifySeen.add(b.ordinal);
      if (ph.check !== undefined && (ph.check !== v["check"] || ph.result !== result)) {
        warn(b.start, "verify-line-disagrees", `phase ${ph.phase}: the Verify line disagrees with the block; block wins`);
      }
      ph.check = v["check"];
      if (result !== undefined) ph.result = result as PhaseVerify["result"];
      else delete ph.result;
      if (result === "failed") ph.why = String(v["why"] ?? "");
      else delete ph.why;
    }
  }
  // In a v2 file ownership comes from the blocks only (C-6): a task no block lists reads as "no path", and a trailing
  // parenthetical on its line is prose, never a phantom path (026:F-4).
  for (const t of tasks) {
    if (assigned.has(t)) continue;
    t.paths = [];
    t.pathIssue = "missing";
  }
  return { format: 2, tasks, phases, issues };
}
