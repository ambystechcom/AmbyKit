import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Repo root, for tests that copy this repo's own specs. */
export const ROOT = join(import.meta.dirname, "..", "..");
export const FIXTURES = join(ROOT, "test", "fixtures", "spec-format");

export function fixture(...parts: string[]): string {
  return readFileSync(join(FIXTURES, ...parts), "utf8");
}

/** A temp project with a minimal config and the given `specs/<feature>/<file>` contents. */
export function tempProject(features: Record<string, Record<string, string>> = {}, config: object = { version: "0.0.0", tools: [] }): string {
  const dir = mkdtempSync(join(tmpdir(), "ambykit-030-"));
  mkdirSync(join(dir, ".amby"), { recursive: true });
  writeFileSync(join(dir, ".amby", "config.json"), JSON.stringify(config));
  for (const [feature, files] of Object.entries(features)) {
    mkdirSync(join(dir, "specs", feature), { recursive: true });
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, "specs", feature, name), text);
  }
  return dir;
}

/** The unsafe-spec set of spike 026 (US-2), built in code so BOMs and mixed line endings survive git's autocrlf. */
export const UNSAFE: Record<string, Record<string, string>> = {
  "910-prose-meta": {
    "spec.md": "---\nfeature: 910\n---\n\n### US-1 — Story\n\nThe **status:** field is explained here in a sentence.\n- **status:** done\n",
  },
  "911-two-status": { "spec.md": "---\nfeature: 911\n---\n\n### US-1 — Story\n\n- **status:** draft\n- **status:** done\n" },
  "913-mixed-eol": { "spec.md": "---\nfeature: 913\n---\r\n\r\n### US-1 — Story\n\n- **status:** done\n" },
  "914-fenced": {
    "spec.md": "---\nfeature: 914\n---\n\n### US-1 — Story\n\n```md\n- **status:** done\n```\n",
    "tasks.md": "## Phase 1\n\n```\n- [ ] [T001] example (src/a.ts)\n```\n",
  },
  "915-dup-verify": {
    "spec.md": "---\nfeature: 915\n---\n\n### US-1 — Story\n",
    "tasks.md": "## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n- **Verify:** one\n- **Verify:** two\n",
  },
  "916-dup-id": {
    "spec.md": "---\nfeature: 916\n---\n\n### US-1 — Story\n",
    "tasks.md": "## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n- [ ] [T001] b (src/b.ts)\n",
  },
  "917-bom": { "spec.md": "﻿---\nfeature: 917\n---\n\n### US-1 — Story\n\n- **status:** done\n" },
};

/** Not unsafe, but needs minimal frontmatter (reported, not skipped). */
export const NO_FRONTMATTER: Record<string, Record<string, string>> = {
  "912-no-frontmatter": { "spec.md": "### US-1 — Story\n\n- **status:** done\n" },
};

/** Copy this repo's own specs (optionally only some features) into a temp project. */
export function ownSpecsCopy(filter: (feature: string) => boolean = () => true): string {
  const dir = mkdtempSync(join(tmpdir(), "ambykit-030-own-"));
  mkdirSync(join(dir, ".amby"), { recursive: true });
  writeFileSync(join(dir, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  const src = join(ROOT, "specs");
  for (const d of readdirSync(src, { withFileTypes: true })) {
    if (d.isDirectory() && filter(d.name) && existsSync(join(src, d.name, "spec.md"))) cpSync(join(src, d.name), join(dir, "specs", d.name), { recursive: true });
  }
  return dir;
}

/**
 * Copy a project into a temp dir and run `migrate` on the copy once the migrate API exists (Phase 6).
 * Until then it only copies, so callers can already build their expectations.
 */
export async function withMigratedCopy(
  projectDir: string,
  opts: { dualWrite?: boolean } = {},
): Promise<{ dir: string; summary?: unknown }> {
  const dir = mkdtempSync(join(tmpdir(), "ambykit-030-migrated-"));
  cpSync(projectDir, dir, { recursive: true });
  let mod: { migrateProject?: (root: string, o: { dualWrite?: boolean }) => Promise<unknown> } = {};
  try {
    mod = (await import("../../src/core/migrate/run.js" as string)) as typeof mod;
  } catch {
    return { dir };
  }
  const summary = await mod.migrateProject?.(dir, opts);
  return { dir, summary };
}
