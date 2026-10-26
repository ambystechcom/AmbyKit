import { execFile } from "node:child_process";
import { readlink } from "node:fs/promises";
import { agentOfProcess, type ProcessInfo } from "../../../core/agents.js";

/**
 * Read-only process scan for agent detection (feature 017, FR-022/FR-023/FR-027). Interactive mode
 * only, on the heartbeat, async, and never more than one scan in flight. Per OS:
 * - Windows: `Get-CimInstance Win32_Process` (no cwd ⇒ matches are unlocated).
 * - macOS: `ps`, then `lsof -d cwd` for matched pids only.
 * - Linux: `ps`, then `/proc/<pid>/cwd` for matched pids only.
 * Any failure yields an empty list: detection is a fallback, never an error.
 */

export type Exec = (file: string, args: string[]) => Promise<string>;

const execAsync: Exec = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, args, { encoding: "utf8", windowsHide: true, timeout: 10_000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout),
    );
  });

/** `ps -o pid=,args=` rows. */
export function parsePs(out: string): { pid: number; command: string }[] {
  const rows: { pid: number; command: string }[] = [];
  for (const line of out.split("\n")) {
    const m = /^\s*(\d+)\s+(.+?)\s*$/.exec(line);
    if (m) rows.push({ pid: Number(m[1]), command: m[2]! });
  }
  return rows;
}

/** `ConvertTo-Json` of `ProcessId, CommandLine` (a single object when there is one process). */
export function parseCim(out: string): { pid: number; command: string }[] {
  if (!out.trim()) return [];
  const raw = JSON.parse(out) as unknown;
  const list = (Array.isArray(raw) ? raw : [raw]) as { ProcessId?: number; CommandLine?: string | null }[];
  return list.filter((p) => typeof p.ProcessId === "number" && p.CommandLine).map((p) => ({ pid: p.ProcessId!, command: p.CommandLine! }));
}

/** `lsof -Fn` output: `p<pid>` then `n<path>` per process. */
export function parseLsof(out: string): Map<number, string> {
  const cwd = new Map<number, string>();
  let pid = -1;
  for (const line of out.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    else if (line.startsWith("n") && pid >= 0) cwd.set(pid, line.slice(1));
  }
  return cwd;
}

// Prefilter on the executable names we can match, so the CIM output stays small.
const CIM = [
  "-NoProfile",
  "-NonInteractive",
  "-Command",
  "Get-CimInstance Win32_Process -Filter \"Name like '%claude%' or Name like '%codex%' or Name like '%opencode%' or Name like '%copilot%' or Name like '%agent%' or Name like 'node%'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
];

export async function listAgentProcesses(platform: NodeJS.Platform = process.platform, exec: Exec = execAsync): Promise<ProcessInfo[]> {
  try {
    if (platform === "win32") {
      const rows = parseCim(await exec("powershell.exe", CIM));
      return rows.filter((r) => agentOfProcess(r.command)).map((r) => ({ ...r, cwd: null }));
    }
    const rows = parsePs(await exec("ps", platform === "darwin" ? ["-axo", "pid=,args="] : ["-eo", "pid=,args="]));
    const matched = rows.filter((r) => agentOfProcess(r.command));
    if (matched.length === 0) return [];
    if (platform === "darwin") {
      let cwd = new Map<number, string>();
      try {
        cwd = parseLsof(await exec("lsof", ["-a", "-d", "cwd", "-p", matched.map((r) => r.pid).join(","), "-Fn"]));
      } catch {
        /* lsof exits 1 when a pid vanished; partial output is lost, so cwd stays unknown */
      }
      return matched.map((r) => ({ ...r, cwd: cwd.get(r.pid) ?? null }));
    }
    return Promise.all(matched.map(async (r) => ({ ...r, cwd: await readlink(`/proc/${r.pid}/cwd`).catch(() => null) })));
  } catch {
    return [];
  }
}

/** Wrap a scan so overlapping calls are skipped while one is in flight (FR-027). */
export function guardedScanner(scan: () => Promise<ProcessInfo[]>): () => Promise<ProcessInfo[] | null> {
  let inFlight = false;
  return async () => {
    if (inFlight) return null;
    inFlight = true;
    try {
      return await scan();
    } finally {
      inFlight = false;
    }
  };
}
