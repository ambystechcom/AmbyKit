import type { FeatureMeter } from "../../src/core/fleet-plan/budget.js";
import type { FleetFeature, FleetRecord, WaitsFor } from "../../src/core/fleet-plan/types.js";
import { FleetSupervisor, type BeginResult, type FeatureRun } from "../../src/cli/run-fleet-loop.js";
import type { Outcome } from "../../src/cli/run-loop.js";

/** A feature run the test drives by hand: nothing is spawned and no git is touched (Principle 5). */
export class FakeFeature implements FeatureRun {
  ticks = 0;
  lanes: { lane: string; assistant: string }[] = [];
  person: string | null = null;
  outcome: Outcome | null = null;
  usage: FeatureMeter = { elapsedMs: 0, tasksUsed: 0 };
  stopped: string | undefined;
  interrupted = false;
  constructor(readonly feature: string, readonly run: string = `${feature}.1`) {}
  tick(): Promise<Outcome | null> {
    this.ticks += 1;
    return Promise.resolve(this.outcome);
  }
  runningLanes(): { lane: string; assistant: string }[] {
    return this.lanes;
  }
  needsPerson(): string | null {
    return this.person;
  }
  meter(): FeatureMeter {
    return this.usage;
  }
  stop(reason: string): void {
    this.stopped = reason;
    this.lanes = [];
  }
  interrupt(): Outcome {
    this.interrupted = true;
    return { kind: "interrupted", message: "interrupted" };
  }
  finish(): void {
    this.outcome = { kind: "done", message: "done" };
    this.lanes = [];
  }
}

export const feature = (name: string, waitsFor: WaitsFor[] = [], files: string[] = []): FleetFeature => ({
  feature: name,
  state: "waiting",
  waitsFor,
  ownership: { files, unknown: [] },
  fingerprint: "f",
});

export const record = (features: FleetFeature[], budgets: Partial<FleetRecord["budgets"]> = {}): FleetRecord => ({
  fleet: "fleet-1",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  features,
  caps: { total: 3, perType: 2 },
  budgets: { wallClockMinutes: 120, maxTasks: 100, ...budgets },
  unattended: false,
});

export interface LoopHarness {
  sup: FleetSupervisor;
  rec: FleetRecord;
  fakes: Map<string, FakeFeature>;
  /** Features in the order `begin` was called. */
  begun: string[];
  saved: FleetRecord[];
  said: string[];
}

/** A fleet supervisor over fake features. `fail` makes a feature's `begin` fail (a merge conflict, say). */
export function loop(features: FleetFeature[], opts: { fail?: Record<string, string>; budgets?: Partial<FleetRecord["budgets"]>; usage?: boolean } = {}): LoopHarness {
  const rec = record(features, opts.budgets);
  const fakes = new Map<string, FakeFeature>();
  const begun: string[] = [];
  const saved: FleetRecord[] = [];
  const said: string[] = [];
  const fail = opts.fail ?? {};
  const sup = new FleetSupervisor(rec, {
    begin: async (f): Promise<BeginResult> => {
      if (fail[f.feature]) return { ok: false, reason: fail[f.feature]! };
      begun.push(f.feature);
      const fake = new FakeFeature(f.feature);
      fakes.set(f.feature, fake);
      return { ok: true, run: fake };
    },
    save: (r) => void saved.push(structuredClone(r)),
    say: (l) => void said.push(l),
    reportsUsage: opts.usage ?? false,
  });
  return { sup, rec, fakes, begun, saved, said };
}

export const states = (h: LoopHarness): Record<string, string> => Object.fromEntries(h.rec.features.map((f) => [f.feature, f.state]));
