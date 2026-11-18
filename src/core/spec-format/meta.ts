import matter from "gray-matter";
import type { SpecMeta } from "./model.js";

/** Feature meta from the spec frontmatter; identical in 1.x and v2. Broken YAML is reported by the v2 reader, not here. */
export function readSpecMeta(text: string): SpecMeta {
  let data: Record<string, unknown> = {};
  try {
    data = (matter(text).data ?? {}) as Record<string, unknown>;
  } catch {
    /* reported as a FormatIssue by the v2 reader */
  }
  const s = (v: unknown): string | undefined => (v === undefined || v === null ? undefined : String(v));
  const meta: SpecMeta = {};
  const feature = s(data["feature"]);
  const title = s(data["title"]);
  const status = s(data["status"]);
  if (feature !== undefined) meta.feature = feature;
  if (title !== undefined) meta.title = title;
  if (status !== undefined) meta.status = status;
  return meta;
}
