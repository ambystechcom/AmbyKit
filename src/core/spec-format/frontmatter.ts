import matter from "gray-matter";
import type { FormatIssue } from "./model.js";

const yamlEngine = (matter as unknown as { engines: { yaml: { parse(s: string): unknown } } }).engines.yaml;

export interface Frontmatter {
  /** Parsed mapping; `{}` when absent or broken. */
  data: Record<string, unknown>;
  /** Raw YAML text between the fences, or "" when there is none. */
  raw: string;
  /** 1-based first YAML line and the line of the closing `---`; 0 when there is no frontmatter. */
  start: number;
  end: number;
  /** Whole text split on `\n` or `\r\n`. */
  lines: string[];
  /** A well-formed `---` block exists (even if its YAML is broken). */
  present: boolean;
}

/** Parse YAML, turning a failure into a located issue (1-based, offset from `baseLine`) instead of a throw. */
export function parseYaml(src: string, baseLine: number, where: string, file: string, issues: FormatIssue[]): unknown {
  try {
    return yamlEngine.parse(src);
  } catch (e) {
    const err = e as { mark?: { line?: number }; reason?: string; message?: string };
    const mark = err.mark?.line;
    issues.push({
      file,
      line: baseLine + (typeof mark === "number" ? mark : 0),
      severity: "error",
      kind: "bad-yaml",
      message: `${where}: invalid YAML (${String(err.reason ?? err.message).split("\n")[0]})`,
    });
    return undefined;
  }
}

/** Split and parse `---` frontmatter. An unclosed or unparseable block adds an issue and yields no data. */
export function readFrontmatter(text: string, file: string, issues: FormatIssue[]): Frontmatter {
  const lines = text.split(/\r?\n/);
  const none: Frontmatter = { data: {}, raw: "", start: 0, end: 0, lines, present: false };
  if (lines[0] !== "---") return none;
  const close = lines.indexOf("---", 1);
  if (close === -1) {
    issues.push({ file, line: 1, severity: "error", kind: "frontmatter-unclosed", message: "frontmatter is not closed with ---" });
    return none;
  }
  const raw = lines.slice(1, close).join("\n");
  const parsed = parseYaml(raw, 2, "frontmatter", file, issues);
  const data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  return { data, raw, start: 2, end: close + 1, lines, present: true };
}
