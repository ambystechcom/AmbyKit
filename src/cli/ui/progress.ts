import type { Capabilities, ChangeSummary } from "./types.js";
import { paint, spinnerFrames, symbols, type Style } from "./theme.js";

/**
 * Live feedback + change summaries for multi-step commands (US-3). The spinner animates only on a
 * TTY; in non-interactive environments it is a no-op so logs stay clean (FR-005). `summarize`
 * formats a `ChangeSummary` (built from fsops.WriteResult) into the created/updated/unchanged/skipped
 * block (FR-006).
 */

export interface Spinner {
  /** Begin feedback for a unit of work. No-op on a non-TTY. */
  start(label: string): void;
  /** Finish successfully: clear the spinner and print a `✓ label` line. */
  succeed(label: string): void;
  /** Abort without a success line (clears the spinner). */
  stop(): void;
}

interface WriteStreamLike {
  write(s: string): unknown;
  isTTY?: boolean;
}

/** Create a spinner bound to a stream (defaults to stdout). */
export function spinner(caps: Capabilities, out: WriteStreamLike = process.stdout): Spinner {
  let timer: ReturnType<typeof setInterval> | null = null;
  let frame = 0;
  let label = "";
  const frames = spinnerFrames(caps);

  const clear = (): void => {
    if (caps.isTTY) out.write("\r\x1b[K");
  };
  const draw = (): void => {
    if (!caps.isTTY) return;
    out.write(`\r\x1b[K${paint(caps, "accent", frames[frame % frames.length]!)} ${label}`);
    frame += 1;
  };

  return {
    start(next) {
      label = next;
      if (!caps.isTTY) return;
      frame = 0;
      draw();
      timer = setInterval(draw, 80);
      if (typeof timer.unref === "function") timer.unref();
    },
    succeed(done) {
      this.stop();
      out.write(`${paint(caps, "success", symbols(caps).success)} ${done}\n`);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      clear();
    },
  };
}

/**
 * Render the change-summary block. Returns "" when there is nothing to report so callers can skip a
 * blank line. Each row is `  <label>  <count>`, colored by role, with the count always labelled so
 * it reads without color.
 */
export function summarize(caps: Capabilities, s: ChangeSummary): string {
  const rows: Array<{ label: string; n: number; style: Style; note?: string }> = s.dryRun
    ? [{ label: "would change", n: s.wouldChange.length, style: "accent" }]
    : [
        { label: "created", n: s.created.length, style: "success" },
        { label: "updated", n: s.updated.length, style: "accent" },
      ];
  rows.push({ label: "unchanged", n: s.unchanged.length, style: "muted" });
  if (s.skipped.length > 0) {
    rows.push({ label: "skipped", n: s.skipped.length, style: "warn", note: "  (use --include-user)" });
  }

  const width = Math.max(...rows.map((r) => r.label.length));
  return rows
    .filter((r) => r.n > 0)
    .map((r) => `  ${paint(caps, r.style, r.label.padEnd(width))}  ${String(r.n).padStart(3)}${r.note ?? ""}`)
    .join("\n");
}
