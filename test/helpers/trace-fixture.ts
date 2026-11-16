import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface TraceFixtureDef {
  /** dir → files (`spec.md`, `tests.md`, …). A string is the spec.md body. */
  specs: Record<string, string | Record<string, string>>;
  /** project-relative path → file content. */
  files?: Record<string, string>;
  config?: Record<string, unknown>;
}

/** Spec text with the given requirement ids, one `- FR-### text` line each. */
export function specWith(...ids: string[]): string {
  return `---\nfeature: x\n---\n\n# Spec\n\n## Requirements (EARS)\n\n${ids.map((id) => `- ${id}  THE SYSTEM SHALL do ${id}.`).join("\n")}\n`;
}

/** A temp AmbyKit project with specs, test files and an optional config. Returns its root. */
export function traceFixture(def: TraceFixtureDef): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-trace-"));
  const put = (rel: string, body: string): void => {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body, "utf8");
  };
  put(".amby/config.json", JSON.stringify({ version: "1.0.0", tools: [], ...(def.config ?? {}) }));
  for (const [dir, v] of Object.entries(def.specs)) {
    const files = typeof v === "string" ? { "spec.md": v } : v;
    for (const [name, body] of Object.entries(files)) put(`specs/${dir}/${name}`, body);
  }
  for (const [rel, body] of Object.entries(def.files ?? {})) put(rel, body);
  return root;
}
