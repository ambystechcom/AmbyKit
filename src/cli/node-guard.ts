// Node version guard (030:FR-015). Pure and import-free so the launcher can run it before the CLI's module graph loads:
// on an older Node a newer-syntax import would otherwise fail with a SyntaxError that hides the message.

/** The minimum Node major AmbyKit 2 supports. */
export const MIN_NODE_MAJOR = 22;

/** The message to print when `version` (e.g. `process.versions.node`) is below the minimum; null when it is fine. */
export function checkNode(version: string): string | null {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  if (Number.isFinite(major) && major >= MIN_NODE_MAJOR) return null;
  return `AmbyKit 2 needs Node.js ${MIN_NODE_MAJOR} or newer (found ${version || "unknown"}). Upgrade Node.js, then run this command again.`;
}
