import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import type { Role } from "./types.js";

/** Project-relative directory holding role definitions (feature 013, FR-001). */
export const ROLES_DIR = ".amby/roles";

/** Word budget per role body; exceeding it warns at sync, never refuses (FR-010). */
export const ROLE_WORD_LIMIT = 150;

const frontmatterSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "kebab-case id"),
  name: z.string().min(1),
  phases: z.array(z.string()).default([]),
});

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Parse one role file. Throws with the file name on invalid frontmatter. */
export function parseRole(raw: string, sourceName: string): Role {
  const parsed = matter(raw);
  const fm = frontmatterSchema.safeParse(parsed.data);
  if (!fm.success) throw new Error(`Invalid role frontmatter in ${sourceName}: ${fm.error.message}`);
  const body = parsed.content.trim();
  return { id: fm.data.id, name: fm.data.name, phases: fm.data.phases, body, words: wordCount(body), source: sourceName };
}

/** Load every `*.md` under `<root>/.amby/roles/`, sorted by id. Empty when the dir is absent (FR-004). */
export function loadRoles(root: string): Role[] {
  const dir = join(root, ROLES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parseRole(readFileSync(join(dir, f), "utf8"), `${ROLES_DIR}/${f}`))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export interface RoleValidation {
  /** Blocking problems (duplicate ids, case-insensitively). */
  errors: string[];
  /** Advisory problems (over the word limit). */
  warnings: string[];
}

export function validateRoles(roles: Role[]): RoleValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Map<string, string>();
  for (const r of roles) {
    const key = r.id.toLowerCase();
    const prev = seen.get(key);
    if (prev) errors.push(`Duplicate role id '${r.id}' (${prev} and ${r.source}).`);
    else seen.set(key, r.source);
    if (r.words > ROLE_WORD_LIMIT) {
      warnings.push(`Role '${r.id}' is ${r.words} words (limit ${ROLE_WORD_LIMIT}) — phases load it every run.`);
    }
  }
  return { errors, warnings };
}

/** The role a phase acts as, or undefined when the spec has none or roles are not installed. */
export function roleForSpec(roles: Role[], roleId: string | undefined): Role | undefined {
  if (!roleId || roles.length === 0) return undefined;
  return roles.find((r) => r.id === roleId);
}
