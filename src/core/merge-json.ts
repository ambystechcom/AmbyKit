/**
 * Splice one named server entry into a JSON config file (feature 025, T060). Pure: text in, text out.
 * It adds or replaces `<key>.<name>` and leaves every other key, and the order of keys, exactly as the
 * user wrote them. A file that is not plain JSON (comments, trailing commas), or whose shape is not what
 * the target documents, is left alone and reported: AmbyKit never rewrites a file it cannot round-trip
 * (Principle 7).
 */

export type JsonMergePlan =
  | { action: "created" | "updated" | "unchanged"; contents: string }
  | { action: "skipped"; reason: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Key-order-independent form, so a user reordering our entry's keys does not read as a change. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isObject(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

export function mergeJsonEntry(existing: string | null, key: string, name: string, entry: unknown): JsonMergePlan {
  if (existing === null || existing.trim() === "") {
    return { action: "created", contents: JSON.stringify({ [key]: { [name]: entry } }, null, 2) + "\n" };
  }
  const text = existing.charCodeAt(0) === 0xfeff ? existing.slice(1) : existing;
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return { action: "skipped", reason: "not plain JSON (comments or trailing commas?); left untouched" };
  }
  if (!isObject(root)) return { action: "skipped", reason: "top level is not a JSON object; left untouched" };
  const group = root[key];
  if (group !== undefined && !isObject(group)) return { action: "skipped", reason: `'${key}' is not an object; left untouched` };

  if (group !== undefined && name in group && canonical(group[name]) === canonical(entry)) return { action: "unchanged", contents: existing };

  const next = { ...root, [key]: { ...(group ?? {}), [name]: entry } };
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const indent = /\n([ \t]+)"/.exec(text)?.[1] ?? "  ";
  let out = JSON.stringify(next, null, indent);
  if (eol === "\r\n") out = out.replace(/\n/g, "\r\n");
  if (/\n\s*$/.test(text) || !/\n/.test(text)) out += eol;
  return { action: "updated", contents: out };
}
