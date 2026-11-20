import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/** Hash of every file under `root` (path and bytes), so a test can prove a tree did not change. */
export function hashTree(root: string): string {
  const h = createHash("sha256");
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else h.update(relative(root, p).replace(/\\/g, "/") + "\0").update(readFileSync(p));
    }
  };
  walk(root);
  return h.digest("hex");
}

/** Every file path under `root` (relative, `/`-separated). */
export function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(relative(root, p).replace(/\\/g, "/"));
    }
  };
  walk(root);
  return out.sort();
}
