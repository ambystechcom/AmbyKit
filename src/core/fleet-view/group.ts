import type { FleetFeatureView, FleetsEntry, FleetsView } from "../fleet/fleet-view.js";
import type { FleetView, LaneView } from "./types.js";

/**
 * Lane grouping across features for the Fleet tab (feature 032, US-1, FR-018). Pure over spec 031's `fleetsView`
 * (`FleetsEntry.features[].lanes`): it adds the group rows, the collapse and the filter, and builds the per-feature
 * `FleetView` that spec 029's reducer and renderer already understand, so the directive and approve rules are not
 * re-implemented here. A single-feature run keeps 029's view (see `isGrouped`).
 */

export interface GroupFilter {
  /** Case-insensitive text matched against the feature, lane and assistant names; empty means no text filter. */
  query: string;
  /** A story status from the shared `s` cycle, mapped onto the lane/feature state words by `STATE_WORDS`. */
  state?: string;
}

export type GroupRow =
  | { kind: "feature"; feature: FleetFeatureView; laneCount: number; expanded: boolean }
  | { kind: "lane"; feature: FleetFeatureView; lane: LaneView; index: number };

/** The shared status filter's words as the fleet's state words; a status with no fleet meaning matches nothing. */
const STATE_WORDS: Record<string, string> = { "in-progress": "working", blocked: "blocked", done: "done" };

/** The word a feature's fleet state is shown as (`running` is `working`, like every other tab). */
export function featureStateWord(state: FleetFeatureView["state"]): string {
  return state === "running" ? "working" : state;
}

/** The fleet shown: the newest by creation time, so a finished older fleet never hides the current one. */
export function currentFleet(view: FleetsView | null | undefined): FleetsEntry | null {
  const fleets = view?.fleets ?? [];
  if (fleets.length === 0) return null;
  return [...fleets].sort((a, b) => Date.parse(b.createdAt || "0") - Date.parse(a.createdAt || "0") || b.fleet.localeCompare(a.fleet))[0]!;
}

/** Group headers are shown only for a real fleet: two or more features. One feature is 029's view, unchanged. */
export function isGrouped(entry: FleetsEntry | null): entry is FleetsEntry {
  return entry !== null && entry.features.length >= 2;
}

const wanted = (f: GroupFilter): string | undefined => (f.state === undefined ? undefined : (STATE_WORDS[f.state] ?? "\u0000"));

function laneMatches(feature: FleetFeatureView, lane: LaneView, f: GroupFilter, featureHit: boolean): boolean {
  const q = f.query.trim().toLowerCase();
  const textOk = q === "" || featureHit || lane.lane.toLowerCase().includes(q) || lane.assistant.toLowerCase().includes(q);
  const state = wanted(f);
  return textOk && (state === undefined || lane.state === state);
}

/** Items (features and lanes) that pass the filter, with `total` the unfiltered count, for the "n of N match" text. */
export function groupCounts(entry: FleetsEntry, f: GroupFilter): { shown: number; total: number } {
  const rows = groupRows(entry, [], f);
  const total = entry.features.length + entry.features.reduce((n, x) => n + x.lanes.length, 0);
  return { shown: rows.length, total };
}

/**
 * The visible rows: each feature header, then its lanes unless it is collapsed. A feature stays when its name matches or
 * any lane does; a feature with no lanes stays only when the text or the state matches the feature itself.
 */
export function groupRows(entry: FleetsEntry, collapsed: readonly string[], f: GroupFilter): GroupRow[] {
  const q = f.query.trim().toLowerCase();
  const state = wanted(f);
  const rows: GroupRow[] = [];
  for (const feature of entry.features) {
    const featureHit = q !== "" && feature.feature.toLowerCase().includes(q);
    const lanes = feature.lanes.map((lane, index) => ({ lane, index })).filter(({ lane }) => laneMatches(feature, lane, f, featureHit));
    const ownState = state === undefined || featureStateWord(feature.state) === state;
    const ownText = q === "" || featureHit;
    const filtered = q !== "" || state !== undefined;
    if (filtered && lanes.length === 0 && !(ownText && ownState && feature.lanes.length === 0)) continue;
    const expanded = !collapsed.includes(feature.feature);
    rows.push({ kind: "feature", feature, laneCount: filtered ? lanes.length : feature.lanes.length, expanded });
    if (expanded) for (const { lane, index } of lanes) rows.push({ kind: "lane", feature, lane, index });
  }
  return rows;
}

/** The 029 view of one feature's run (header, lanes, gates), or null for a feature that has not started. */
export function featureRunView(feature: FleetFeatureView, now: number): FleetView | null {
  if (!feature.run) return null;
  return { run: feature.run, lanes: feature.lanes, others: [], now };
}

/** Pending gates across the fleet, each with the feature it belongs to, for the GATES lines. */
export function fleetGates(entry: FleetsEntry): { feature: string; id: string; after: string }[] {
  return entry.features.flatMap((f) => (f.run?.gates ?? []).filter((g) => g.state === "pending").map((g) => ({ feature: f.feature, id: g.id, after: String(g.after) })));
}

/** The lanes of one run that pass the filter (a run's own lane list, for a fleet of one feature). */
export function filterLanes(lanes: LaneView[], f: GroupFilter): LaneView[] {
  const q = f.query.trim().toLowerCase();
  const state = wanted(f);
  if (q === "" && state === undefined) return lanes;
  return lanes.filter((l) => (q === "" || l.lane.toLowerCase().includes(q) || l.assistant.toLowerCase().includes(q)) && (state === undefined || l.state === state));
}
