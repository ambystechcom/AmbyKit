import { heldFeatures } from "../core/fleet-plan/contain.js";
import { fleetBudgetDecision, type FeatureMeter } from "../core/fleet-plan/budget.js";
import { startableFeatures } from "../core/fleet-plan/schedule.js";
import type { FleetFeature, FleetRecord } from "../core/fleet-plan/types.js";
import type { Outcome } from "./run-loop.js";

/**
 * The fleet supervisor (feature 031): one tick loop above 028's per-feature `Supervisor`. Each feature keeps its own
 * session, lanes, gates and merge (a `FeatureRun`); this loop owns what is shared: when a feature may start (what it
 * waits for is done), containment (a paused feature holds its dependents, independent ones keep running), the
 * fleet-wide budgets and the fleet record. It never calls a model and never touches git or processes itself:
 * starting a feature, and everything about its lanes, is behind `FeatureRun` and `begin`, so tests drive it with
 * fakes and a fake clock (Principle 5).
 */

/** One running feature, as the fleet loop sees it. */
export interface FeatureRun {
  feature: string;
  run: string;
  /** Advance the feature's own supervisor one tick (028's `Supervisor.tick`). */
  tick(): Promise<Outcome | null>;
  /** Lanes with a live process: they occupy fleet-wide slots. */
  runningLanes(): { lane: string; assistant: string }[];
  /** Why the feature waits for a person (a paused, conflicting, escalated or failed lane), or null. */
  needsPerson(): string | null;
  meter(): FeatureMeter;
  /** Begin a budget stop (nothing new starts; running lanes get a stop directive). */
  stop(reason: string): void;
  /** Save-and-exit: ask lanes to stop and leave state resumable. */
  interrupt(): Outcome;
}

export type BeginResult = { ok: true; run: FeatureRun } | { ok: false; reason: string };

export interface FleetLoopDeps {
  /** Merge what the feature waits for into its branch, prepare its lanes and start its run. A failure pauses only it. */
  begin(feature: FleetFeature): Promise<BeginResult>;
  /** Persist the fleet record after a change. */
  save(record: FleetRecord): void;
  say(line: string): void;
  /** True when every runner of the fleet reports usage (a token ceiling is enforceable). */
  reportsUsage: boolean;
}

export type FleetOutcomeKind = "done" | "budget" | "attention" | "interrupted";

export interface FleetOutcome {
  kind: FleetOutcomeKind;
  message: string;
}

const HOLDING = new Set(["stays", "rejected", "attention"]);

export class FleetSupervisor {
  private readonly runs = new Map<string, FeatureRun>();
  private stopReason: string | undefined;
  private lastSaid = new Map<string, string>();

  constructor(
    readonly record: FleetRecord,
    private readonly deps: FleetLoopDeps,
    /** Runs adopted from an earlier session (`--continue-fleet`). */
    adopted: FeatureRun[] = [],
  ) {
    for (const r of adopted) this.runs.set(r.feature, r);
  }

  /** The lanes running in every feature other than `feature`: the fleet-wide slots (028's `Session.slots`). */
  slotsFor(feature: string): { lane: string; assistant: string }[] {
    return [...this.runs.entries()].filter(([f]) => f !== feature).flatMap(([, r]) => r.runningLanes());
  }

  featureRun(feature: string): FeatureRun | undefined {
    return this.runs.get(feature);
  }

  private say(feature: string, line: string): void {
    if (this.lastSaid.get(feature) === line) return; // a waiting condition is announced once, not every tick
    this.lastSaid.set(feature, line);
    this.deps.say(line);
  }

  async tick(): Promise<FleetOutcome | null> {
    const rec = this.record;
    let changed = false;
    const set = (f: FleetFeature, state: FleetFeature["state"], cause?: string): void => {
      if (f.state !== state || f.cause !== cause) {
        const was = f.state;
        f.state = state;
        if (cause === undefined) delete f.cause;
        else f.cause = cause;
        changed = true;
        if (was !== state) this.deps.say(`${f.feature}: ${state}${cause ? ` (${cause})` : ""}`);
      }
    };

    // 1. every started feature takes its own tick; its state follows what its supervisor and lanes report
    for (const f of rec.features) {
      const run = this.runs.get(f.feature);
      if (!run || f.state === "done" || f.state === "skipped") continue;
      const out = await run.tick();
      if (out?.kind === "done") set(f, "done");
      else if (out && HOLDING.has(out.kind)) set(f, "paused", out.message);
      else {
        const why = run.needsPerson();
        if (why !== null && !this.stopReason) set(f, "paused", why);
        else set(f, "running");
      }
    }

    // 2. containment: a paused feature holds what waits for it; resuming releases (recomputed every tick)
    const paused = new Set(rec.features.filter((f) => f.state === "paused").map((f) => f.feature));
    const held = heldFeatures(rec.features, paused);
    for (const f of rec.features) {
      const by = held.get(f.feature);
      if (f.heldBy !== by) {
        if (by === undefined) delete f.heldBy;
        else f.heldBy = by;
        changed = true;
        this.say(f.feature, by ? `${f.feature}: held while ${by} is paused` : `${f.feature}: released`);
      }
    }

    // 3. fleet-wide budgets over the features' meters
    if (!this.stopReason) {
      const meters = [...this.runs.values()].map((r) => r.meter());
      const d = fleetBudgetDecision(rec.budgets, meters, this.deps.reportsUsage);
      if (d.exceeded && d.reason) {
        this.stopReason = d.reason;
        const note = d.unenforced.length > 0 ? ` (${d.unenforced.join("; ")})` : "";
        this.deps.say(`Fleet budget exceeded: ${d.reason}${note}. No new lanes start and running lanes are asked to stop.`);
        for (const r of this.runs.values()) r.stop(d.reason);
        rec.status = "paused";
        changed = true;
      }
    }
    if (this.stopReason) {
      if (changed) this.deps.save(rec);
      const running = [...this.runs.values()].some((r) => r.runningLanes().length > 0);
      if (running) return null;
      return { kind: "budget", message: `Stopped: ${this.stopReason}. State is saved in ${rec.fleet}; continue with --continue-fleet=${rec.fleet} after raising the budget.` };
    }

    // 3b. start the features that may: nothing they wait for is outstanding and nothing holds them. A feature
    // paused before it started (a merge conflict) is retried, so resolving it by hand lets the fleet carry on.
    const retry = rec.features.filter((f) => f.state === "paused" && !this.runs.has(f.feature) && f.heldBy === undefined);
    for (const f of [...startableFeatures(rec.features), ...retry]) {
      const began = await this.deps.begin(f);
      if (began.ok) {
        this.runs.set(f.feature, began.run);
        f.run = began.run.run;
        set(f, "running");
        changed = true;
      } else {
        set(f, "paused", began.reason);
        this.say(f.feature, `${f.feature}: not started — ${began.reason}`);
      }
    }

    // 4. the record follows the features
    const everyone = rec.features.every((f) => f.state === "done" || f.state === "skipped");
    const next = everyone ? "done" : rec.features.some((f) => f.state === "paused") ? "waiting-person" : "active";
    if (rec.status !== next) {
      rec.status = next;
      changed = true;
    }
    if (changed) this.deps.save(rec);
    if (everyone) return { kind: "done", message: `Fleet ${rec.fleet} is done: ${rec.features.length} feature${rec.features.length === 1 ? "" : "s"} built (lanes merged into their feature branches).` };

    // a deadlock guard: waiting features, nothing running, nothing paused and nothing startable cannot progress
    const live = rec.features.some((f) => f.state === "running" || f.state === "paused");
    if (!live && rec.features.some((f) => f.state === "waiting")) {
      return { kind: "attention", message: `Fleet ${rec.fleet} cannot progress: ${rec.features.filter((f) => f.state === "waiting").map((f) => f.feature).join(", ")} wait for something that will not finish.` };
    }
    return null;
  }

  /** Save-and-exit for SIGINT/SIGTERM: every started feature stops its lanes and leaves resumable state. */
  interrupt(): FleetOutcome {
    for (const r of this.runs.values()) r.interrupt();
    this.record.status = "paused";
    this.deps.save(this.record);
    return { kind: "interrupted", message: `Interrupted. State is saved in ${this.record.fleet}; continue with --continue-fleet=${this.record.fleet}.` };
  }
}

/** Tick until the fleet ends or `interrupted()` is true. */
export async function superviseFleet(
  sup: FleetSupervisor,
  opts: { sleep: (ms: number) => Promise<void>; interrupted: () => boolean; tickMs: number },
): Promise<FleetOutcome> {
  for (;;) {
    if (opts.interrupted()) return sup.interrupt();
    const out = await sup.tick();
    if (out) return out;
    await opts.sleep(opts.tickMs);
  }
}
