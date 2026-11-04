import type { BaseCommand } from "../../src/cli/base-command.js";

/** Run a CLI verb in-process, capturing stdout/stderr text. */
export async function runCommand(
  cmd: BaseCommand,
  cwd: string,
  positionals: string[],
  flags: Record<string, string | boolean> = {},
): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const [oLog, oErr, oWarn] = [console.log, console.error, console.warn];
  console.log = (...a: unknown[]) => void out.push(a.join(" "));
  console.error = (...a: unknown[]) => void err.push(a.join(" "));
  console.warn = (...a: unknown[]) => void err.push(a.join(" "));
  try {
    const code = await cmd.run({ cwd, positionals, flags });
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    [console.log, console.error, console.warn] = [oLog, oErr, oWarn];
  }
}
