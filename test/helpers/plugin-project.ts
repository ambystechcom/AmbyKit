import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "plugins");

export interface PluginProjectOptions {
  tools?: string[];
  /** `plugins` config map: package name → pin. */
  plugins?: Record<string, string>;
  /** Fixture packages copied into `<root>/node_modules/` (default: every key of `plugins`). */
  install?: string[];
  /** Extra config keys. */
  config?: Record<string, unknown>;
}

/** A throwaway project with `.amby/config.json` and the named fixture plugins installed under node_modules. */
export function pluginProject(opts: PluginProjectOptions = {}): string {
  const root = join(mkdtempSync(join(tmpdir(), "ambykit-plugin-")), "demo");
  mkdirSync(join(root, ".amby"), { recursive: true });
  const config = {
    version: "0.0.0",
    tools: opts.tools ?? [],
    ...(opts.plugins ? { plugins: opts.plugins } : {}),
    ...(opts.config ?? {}),
  };
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify(config));
  for (const name of opts.install ?? Object.keys(opts.plugins ?? {})) installFixture(root, name);
  return root;
}

/** Copy one fixture plugin into a project's `node_modules`. */
export function installFixture(root: string, name: string): void {
  cpSync(join(FIXTURES, name), join(root, "node_modules", ...name.split("/")), { recursive: true });
}
