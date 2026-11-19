import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { win32 } from "node:path";

/**
 * The process edge (feature 028): the only place `ambykit run` uses `node:child_process`. Everything else
 * depends on `ProcessPort`, so tests drive the supervisor with a fake port and a fake clock and never start a
 * model (Principle 5).
 */

export interface SpawnSpec {
  exe: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  /** Written to the process's stdin, then closed. */
  stdin?: string;
}

export interface ExitInfo {
  code: number | null;
  signal: string | null;
}

export interface ProcessHandle {
  pid: number | undefined;
  alive(): boolean;
  exited: Promise<ExitInfo>;
  kill(signal?: "SIGTERM" | "SIGKILL"): void;
}

export interface ProcessPort {
  spawn(spec: SpawnSpec): ProcessHandle;
  /** Whether a process from an earlier session is still running (used by `--continue-run`). */
  isAlive(pid: number): boolean;
  /** Stop a process by pid, for a process this session did not spawn. */
  kill(pid: number, signal?: "SIGTERM" | "SIGKILL"): void;
}

/** Windows ships assistants as `.cmd` shims, which `spawn` cannot run directly; resolve the executable first. */
export function resolveExecutable(
  exe: string,
  env: Record<string, string | undefined> = process.env,
  platform: NodeJS.Platform = process.platform,
  exists: (p: string) => boolean = existsSync,
): string {
  if (platform !== "win32") return exe;
  if (/[\\/]/.test(exe) && exists(exe)) return exe;
  const exts = (env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  const dirs = (env["PATH"] ?? env["Path"] ?? "").split(win32.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const ext of ["", ...exts]) {
      const candidate = win32.join(dir, exe + ext);
      if (exists(candidate) && (ext !== "" || /\.[a-z]+$/i.test(exe))) return candidate;
    }
  }
  return exe;
}

/** `.cmd` and `.bat` files must run through `cmd.exe`; everything else spawns directly. */
export function windowsCommand(resolved: string, args: string[]): { exe: string; args: string[]; verbatim: boolean } {
  if (!/\.(cmd|bat)$/i.test(resolved)) return { exe: resolved, args, verbatim: false };
  const quote = (a: string): string => (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(a) ? a : `"${a.replace(/"/g, '""')}"`);
  return { exe: "cmd.exe", args: ["/d", "/s", "/c", `"${[resolved, ...args].map(quote).join(" ")}"`], verbatim: true };
}

class NodeHandle implements ProcessHandle {
  private done = false;
  readonly exited: Promise<ExitInfo>;
  constructor(private readonly child: ChildProcess) {
    this.exited = new Promise((resolve) => {
      child.once("error", () => {
        this.done = true;
        resolve({ code: 127, signal: null });
      });
      child.once("exit", (code, signal) => {
        this.done = true;
        resolve({ code, signal });
      });
    });
  }
  get pid(): number | undefined {
    return this.child.pid;
  }
  alive(): boolean {
    return !this.done;
  }
  kill(signal: "SIGTERM" | "SIGKILL" = "SIGTERM"): void {
    if (this.done || this.child.pid === undefined) return;
    if (process.platform === "win32") {
      // Windows has no signals: terminate the whole tree, as a shim spawns a child.
      try {
        spawn("taskkill", ["/pid", String(this.child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      } catch {
        this.child.kill();
      }
      return;
    }
    this.child.kill(signal);
  }
}

export const nodeProcessPort: ProcessPort = {
  spawn(spec) {
    const resolved = windowsCommand(resolveExecutable(spec.exe), spec.args);
    const child = spawn(resolved.exe, resolved.args, {
      cwd: spec.cwd,
      env: { ...process.env, ...(spec.env ?? {}) },
      stdio: ["pipe", "ignore", "ignore"],
      windowsHide: true,
      windowsVerbatimArguments: resolved.verbatim,
    });
    child.stdin?.on("error", () => undefined);
    child.stdin?.end(spec.stdin ?? "");
    return new NodeHandle(child);
  },
  isAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return (err as NodeJS.ErrnoException).code === "EPERM";
    }
  },
  kill(pid, signal = "SIGTERM") {
    try {
      process.kill(pid, signal);
    } catch {
      /* already gone */
    }
  },
};
