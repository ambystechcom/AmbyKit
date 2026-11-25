import { readRun, updateRun } from "../core/fleet/index.js";
import { writeLaneFile } from "./run-files.js";
import { enforceBudgets, meter, stopAll } from "./run-budget.js";
import { applyDirectives, applyReassignments, heldByDirective } from "./run-control.js";
import { afterPhase } from "./run-gates.js";
import { launchQueued, running } from "./run-launch.js";
import { mergeReady } from "./run-merger.js";
import { advanceReviews } from "./run-protocol.js";
import { event, isRunning, save, type Session } from "./run-session.js";
import { collectExits, enforceStopGrace, noteAdoptedExits, superviseStalls } from "./run-supervisor.js";

/**
 * The tick loop (feature 028): one supervisor process per run, foreground only, no daemon. Each tick reads
 * files (activity markers, `tasks.md`, directives, verdicts) and process liveness, applies the pure rules, and
 * acts. It never calls a model. `tick()` is separate from the waiting between ticks so tests drive it with a
 * fake clock and a fake process port.
 */

export type OutcomeKind =
  | "done" // every lane merged
  | "budget" // a budget was exceeded and everything has stopped
  | "stays" // non-[P] tasks need a person
  | "rejected" // a person rejected a checkpoint
  | "attention" // nothing can progress without a person (unfinished, failed or escalated lanes)
  | "interrupted";

export interface Outcome {
  kind: OutcomeKind;
  message: string;
}

const BUSY = new Set(["running", "reviewing", "finished", "ready", "queued"]);
/** Lane states that wait for a person and keep the foreground process polling. */
const WAITING_FOR_PERSON = new Set(["paused", "conflict", "escalated"]);

export class Supervisor {
  private last: number;
  /** Phase whose gate is being waited on, so the wait is announced once. */
  waitingGate: string | undefined;

  constructor(private readonly s: Session, private readonly review = true) {
    this.last = s.now();
  }

  /** The phase currently being worked: the lowest phase with a lane that is not merged. */
  currentPhase(): number | null {
    const open = this.s.lanes.filter((l) => l.file.status !== "merged").map((l) => l.ref.manifest.phase);
    return open.length > 0 ? Math.min(...open) : null;
  }

  async tick(): Promise<Outcome | null> {
    const s = this.s;
    const dt = s.now() - this.last;
    this.last = s.now();

    noteAdoptedExits(s);
    collectExits(s);
    applyDirectives(s);
    applyReassignments(s);
    superviseStalls(s);
    enforceStopGrace(s);
    advanceReviews(s, this.review);
    mergeReady(s);
    meter(s, dt);
    enforceBudgets(s);

    if (s.stopReason) return this.stopping();

    const phase = this.currentPhase();
    if (phase === null) {
      // every prepared lane merged: the next stage (sequential tasks included) is prepared from the merged code
      const next = this.prepareNext();
      return next === "continue" ? null : (next ?? this.finish());
    }

    // The current phase's lanes are all merged only when `phase` moved on; gate between sets.
    const gate = this.phaseGate(phase);
    if (gate) return gate === "continue" ? null : gate;

    const held = heldByDirective(s);
    for (const rt of s.lanes) if (held.has(rt.file.lane) && rt.file.status === "queued") rt.file.status = "paused";
    launchQueued(s, phase);
    return this.attention(phase);
  }

  /** After a set merged, wait for its checkpoint; returns an outcome to end the run, "continue" to keep polling. */
  private phaseGate(phase: number): Outcome | "continue" | null {
    const s = this.s;
    const prev = s.lanes.filter((l) => l.ref.manifest.phase < phase);
    if (prev.length === 0) return null;
    const prevPhase = Math.max(...prev.map((l) => l.ref.manifest.phase));
    const out = afterPhase(s, prevPhase);
    if (out.kind === "advance") {
      this.waitingGate = undefined;
      return null;
    }
    if (out.kind === "stays") {
      updateRun(s.root, s.run, { status: "waiting-person", needsDecision: true });
      return { kind: "stays", message: `Phase ${prevPhase} has tasks that are not parallel (${out.tasks.join(", ")}). Run them with /amby.implement, then continue with --continue-run=${s.run}.` };
    }
    if (out.kind === "rejected") {
      return { kind: "rejected", message: `Checkpoint ${out.gate} was rejected${out.reason ? `: ${out.reason}` : ""}. The run is paused; approve it to continue.` };
    }
    if (this.waitingGate !== out.gate) {
      this.waitingGate = out.gate;
      event(s, "gate-waiting", undefined, out.gate);
    }
    return "continue";
  }

  /** Add the next stage's lanes; "continue" when lanes were added, an outcome when a person must act, null when nothing is left. */
  private prepareNext(): Outcome | "continue" | null {
    const s = this.s;
    if (!s.prepareNext) return null;
    // every task of a lane this run merged counts as done (a hand-resolved merge may have lost its tick)
    const merged = new Set(s.lanes.filter((l) => l.file.status === "merged").flatMap((l) => l.ref.manifest.tasks.map((t) => t.id)));
    const next = s.prepareNext(merged);
    if (next.kind === "none") return null;
    if (next.kind === "failed") {
      updateRun(s.root, s.run, { status: "waiting-person", needsDecision: true });
      event(s, "stage-failed", undefined, next.reason);
      return { kind: "attention", message: `Run ${s.run} cannot prepare its next stage: ${next.reason}` };
    }
    const rec = readRun(s.root, s.run);
    const added = next.lanes.filter((l) => !s.lanes.some((x) => x.ref.name === l.ref.name));
    for (const l of added) {
      const file = { lane: l.ref.short, full: l.ref.name, assistant: l.assistant, status: "queued" as const, restarts: 0 };
      writeLaneFile(s.root, s.run, file);
      s.lanes.push({ ref: l.ref, assistant: l.assistant, file, job: "worker", round: 1 });
    }
    if (rec) {
      const lanes = [...rec.lanes, ...added.map((l) => ({ lane: l.ref.name, assistant: l.assistant, tasks: l.ref.manifest.tasks.map((t) => t.id) }))];
      updateRun(s.root, s.run, { lanes });
    }
    const detail = `phase ${next.phase}, ${next.stage}: ${added.map((l) => `${l.ref.short} (${l.ref.manifest.tasks.map((t) => t.id).join(", ")})`).join("; ")}`;
    event(s, "stage-prepared", undefined, detail);
    s.say(`Next stage ${detail}`);
    return added.length > 0 ? "continue" : null;
  }

  private stopping(): Outcome | null {
    const s = this.s;
    if (running(s).length > 0) return null;
    // a process just ended: let its exit be recorded (next tick) before the run reports it stopped
    if (s.lanes.some((l) => l.file.status === "running" || l.file.status === "reviewing")) return null;
    updateRun(s.root, s.run, { status: "paused" });
    return { kind: "budget", message: `Stopped: ${s.stopReason}. State is saved; continue with --continue-run=${s.run} after raising the budget.` };
  }

  private finish(): Outcome {
    const s = this.s;
    updateRun(s.root, s.run, { status: "done", needsDecision: false });
    event(s, "done");
    return { kind: "done", message: `Run ${s.run} is done: every lane merged.` };
  }

  /** Nothing running and nothing left to start: a person has to act (unfinished, failed or escalated lanes). */
  private attention(phase: number): Outcome | null {
    const s = this.s;
    const here = s.lanes.filter((l) => l.ref.manifest.phase === phase);
    if (s.lanes.some((l) => isRunning(s, l))) return null;
    if (here.some((l) => BUSY.has(l.file.status))) return null;
    if (here.some((l) => WAITING_FOR_PERSON.has(l.file.status))) return null;
    const stuck = here.filter((l) => l.file.status !== "merged");
    if (stuck.length === 0) return null;
    updateRun(s.root, s.run, { status: "waiting-person", needsDecision: true });
    return {
      kind: "attention",
      message: `Run ${s.run} cannot continue without a person: ${stuck.map((l) => `${l.file.lane} ${l.file.status}${l.file.reason ? ` (${l.file.reason})` : ""}`).join("; ")}.`,
    };
  }

  /** Save-and-exit for SIGINT/SIGTERM: ask lanes to stop, record where each one is, leave state resumable. */
  interrupt(): Outcome {
    const s = this.s;
    stopAll(s, "SIGTERM");
    for (const rt of s.lanes) {
      if (rt.file.status === "running" || rt.file.status === "reviewing") {
        rt.file.status = "queued";
        rt.file.reason = "interrupted";
        delete rt.handle;
        delete rt.file.pid;
        save(s, rt);
      }
    }
    updateRun(s.root, s.run, { status: "paused" });
    event(s, "interrupted");
    return { kind: "interrupted", message: `Interrupted. State is saved; continue with --continue-run=${s.run}.` };
  }
}

/** Tick until the run ends or `interrupted()` is true. */
export async function superviseRun(
  sup: Supervisor,
  s: Session,
  opts: { sleep: (ms: number) => Promise<void>; interrupted: () => boolean; onGate?: (gate: string) => Promise<void> },
): Promise<Outcome> {
  for (;;) {
    if (opts.interrupted()) return sup.interrupt();
    const out = await sup.tick();
    if (out) return out;
    if (sup.waitingGate && opts.onGate) await opts.onGate(sup.waitingGate);
    await opts.sleep(s.settings.tickSeconds * 1000);
  }
}

