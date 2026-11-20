# Data model — Multi-feature fleets

`.amby/fleet/fleet-<n>/fleet.json` (local, self-ignored with the rest of `.amby/fleet/`):

```ts
interface FleetRecord {
  fleet: string;                       // "fleet-3"
  status: "active" | "paused" | "waiting-person" | "done";
  createdAt: string;
  features: FleetFeature[];            // in planned start order
  caps: { total: number; perType: number };
  budgets: { wallClockMinutes: number; maxTasks: number; maxTokens?: number };
  unattended: boolean;
}
interface FleetFeature {
  feature: string;                     // "031-multi-feature-fleets"
  run?: string;                        // "031-multi-feature-fleets.1" once started (dir nested in fleet-<n>/)
  state: "waiting" | "running" | "paused" | "done" | "skipped";
  waitsFor: { feature: string; why: "depends-on" | "story-edge" | "shared-files"; files?: string[] }[];
  heldBy?: string;                     // feature whose pause holds this one
  ownership: { files: string[]; unknown: string[] };   // unknown = task ids with no ownership
  fingerprint: string;                 // hash of what the plan was made from (spec and tasks via the 030 reader)
}
```

Invariants: `features` order respects every `waitsFor`; no cycles; a feature with `state: running` has a `run`; non-empty `unknown` => it `waitsFor` every other feature (`why: shared-files`). Per-feature runs keep 019/028's `run.json`, lane files, events and directives unchanged.
