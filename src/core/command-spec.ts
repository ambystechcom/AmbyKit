import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import type { CommandSpec } from "./types.js";
import { promptsDir } from "./paths.js";

const abstractTool = z.enum(["read", "write", "edit", "bash"]);

/** Schema for the YAML frontmatter of a neutral prompt file. */
const frontmatterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  "argument-hint": z.string().default(""),
  phase: z.string().min(1),
  reads: z.array(z.string()).default([]),
  writes: z.array(z.string()).default([]),
  allowedTools: z.array(abstractTool).default([]),
});

/** Parse a single prompt file's raw contents into a CommandSpec. */
export function parseCommandSpec(raw: string, sourceName: string): CommandSpec {
  const parsed = matter(raw);
  const fm = frontmatterSchema.safeParse(parsed.data);
  if (!fm.success) {
    throw new Error(`Invalid prompt frontmatter in ${sourceName}: ${fm.error.message}`);
  }
  const data = fm.data;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    argumentHint: data["argument-hint"],
    phase: data.phase,
    reads: data.reads,
    writes: data.writes,
    allowedTools: data.allowedTools,
    body: parsed.content.trim(),
  };
}

/** Load all neutral phase prompts, sorted by id for deterministic output. */
export function loadCommandSpecs(dir: string = promptsDir()): CommandSpec[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const specs = files.map((file) => {
    const raw = readFileSync(join(dir, file), "utf8");
    return parseCommandSpec(raw, file);
  });
  return specs.sort((a, b) => a.id.localeCompare(b.id));
}
