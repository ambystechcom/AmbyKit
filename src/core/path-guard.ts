/**
 * True when a project-scope path would leave the project root: empty, absolute, a drive letter, or a `..`
 * segment (feature 027, FR-007). Pure; shared by `buildEmittedFiles` and the plugin test kit.
 */
export function escapesProject(path: string): boolean {
  const p = path.replaceAll("\\", "/");
  return p === "" || p.startsWith("/") || /^[A-Za-z]:/.test(p) || p.split("/").includes("..");
}
