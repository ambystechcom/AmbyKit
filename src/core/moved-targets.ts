/**
 * Targets that moved out of the core into an official plugin (feature 027, FR-014). A project that still
 * lists such a target gets a notice naming the package to install; nothing it already wrote is removed.
 *
 * Empty in 1.6: no built-in target is extracted yet. The mechanism ships first, and the first extraction
 * follows once the API has been used (`docs/plugin-split.md`, plan open decision 3). When a target moves,
 * add `"<id>": { package: "ambykit-emitter-<id>", since: "<release>" }` here and drop it from `TARGETS`.
 */
import { TARGETS } from "../emitters/index.js";

export interface MovedTarget {
  /** The npm package that now provides the target. */
  package: string;
  /** The AmbyKit release that stopped bundling it. */
  since: string;
}

export const MOVED_TARGETS: Record<string, MovedTarget> = {};

/**
 * Targets still bundled that will move once their official plugin is published (feature 036, C-4): the id, and the
 * package that will replace it. They keep working and get a deprecation notice; nothing is removed until the plugin ships.
 */
export interface DeprecatedTarget {
  /** The npm package that will replace the built-in target. */
  package: string;
}

export const DEPRECATED_TARGETS: Record<string, DeprecatedTarget> = {};

/**
 * What a target id is, for `init`, `add`, `check`, `update` and the docs check (feature 036, FR-001/FR-002):
 * one answer to "is this core?".
 * - `built-in`: bundled and not going away.
 * - `deprecated`: bundled today, replaced by `package` once that plugin is published.
 * - `moved`: no longer bundled; `package` provides it since `since`.
 * - `unknown`: neither bundled nor known to have moved (a typo, or a plugin's own id).
 */
export type TargetStatus =
  | { state: "built-in" }
  | { state: "deprecated"; package: string }
  | { state: "moved"; package: string; since: string }
  | { state: "unknown" };

export interface TargetStatusSources {
  /** The ids bundled with this AmbyKit (default: the built-in registry). */
  bundled: readonly string[];
  moved: Readonly<Record<string, MovedTarget>>;
  deprecated: Readonly<Record<string, DeprecatedTarget>>;
}

/** Pure: the sources are parameters so tests can describe a future registry without touching the real one. */
export function targetStatus(
  id: string,
  sources: TargetStatusSources = { bundled: TARGETS.map((t) => t.id), moved: MOVED_TARGETS, deprecated: DEPRECATED_TARGETS },
): TargetStatus {
  const moved = movedTarget(id, sources.moved);
  if (moved) return { state: "moved", package: moved.package, since: moved.since };
  if (!sources.bundled.includes(id)) return { state: "unknown" };
  if (Object.hasOwn(sources.deprecated, id)) return { state: "deprecated", package: sources.deprecated[id]!.package };
  return { state: "built-in" };
}

/** Where a moved target lives now, or undefined for a target that did not move. Pure. */
export function movedTarget(id: string, map: Readonly<Record<string, MovedTarget>> = MOVED_TARGETS): MovedTarget | undefined {
  return Object.hasOwn(map, id) ? map[id] : undefined;
}

/**
 * One notice per configured target that is no longer bundled and has moved. `known` says whether a target
 * is available (built in, or from a plugin that loaded); a moved target that a plugin now provides is not
 * reported. Pure.
 */
export function movedTargetNotices(
  ids: readonly string[],
  known: (id: string) => boolean,
  map: Readonly<Record<string, MovedTarget>> = MOVED_TARGETS,
): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (known(id)) continue;
    const moved = movedTarget(id, map);
    if (!moved) continue;
    out.push(
      `Target '${id}' moved to the plugin ${moved.package} (since ${moved.since}). Run \`npm install --save-exact ${moved.package}\` and list it under "plugins" in .amby/config.json with that exact version. Files already written for it are left in place.`,
    );
  }
  return out;
}
