/**
 * The deprecation notice (feature 033, FR-010, FR-011). A stable name is deprecated for one minor release before it is removed in
 * the next major, and using it prints one line naming its replacement, once per process, to the error stream; the behaviour does not
 * change. Nothing is deprecated at 2.0: this is the mechanism the policy in `docs/stability.md` describes. No network, no telemetry
 * (Principle 7): it only writes a line.
 */

const announced = new Set<string>();

/** The one line, so a test and the docs can show it. */
export function deprecationLine(name: string, replacement: string): string {
  return `ambykit: '${name}' is deprecated and will be removed in the next major release; use '${replacement}' instead.`;
}

/**
 * Print the notice for `name` unless it already was in this process. Returns true when it printed. `write` is injectable for
 * tests; it defaults to stderr, never stdout, so `--json` output is not disturbed.
 */
export function deprecated(name: string, replacement: string, write: (line: string) => void = (line) => void process.stderr.write(line + "\n")): boolean {
  if (announced.has(name)) return false;
  announced.add(name);
  write(deprecationLine(name, replacement));
  return true;
}

/** Forget what was announced. Tests only. */
export function resetDeprecations(): void {
  announced.clear();
}
