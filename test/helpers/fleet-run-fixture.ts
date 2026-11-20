import { RunCommand, type RunDeps } from "../../src/cli/run.js";
import { RUNNERS } from "../../src/core/runners.js";
import { FakePort, fakeRegistry } from "./run-fakes.js";
import { runCommand } from "./run-command.js";

/** A fake process port for fleet tests (nothing is ever spawned). */
export const fakePort = (): FakePort => new FakePort();

export interface FleetRunOptions {
  port?: FakePort;
  /** False keeps the shipped (unverified) registry, so the runner refusal is exercised. */
  registryVerified?: boolean;
  deps?: Partial<RunDeps>;
}

/** `ambykit run <features...>` in-process with a fake port, a fake registry and a no-wait clock. */
export function fleetRun(
  root: string,
  positionals: string[],
  flags: Record<string, string | boolean>,
  opts: FleetRunOptions = {},
): Promise<{ code: number; out: string; err: string }> {
  const cmd = new RunCommand({
    registry: opts.registryVerified === false ? RUNNERS : fakeRegistry(["claude", "codex"]),
    port: opts.port ?? new FakePort(),
    now: () => Date.now(),
    sleep: async () => undefined,
    interactive: false,
    ...(opts.deps ?? {}),
  });
  return runCommand(cmd, root, positionals, flags);
}
