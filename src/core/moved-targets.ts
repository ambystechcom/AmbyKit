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
  /** The name `init` and `add` show for it (the plugin provides it once installed). */
  displayName?: string;
}

/**
 * Targets still bundled that will move once their official plugin is published (feature 036, C-4): the id, and the
 * package that will replace it. They keep working and get a deprecation notice; nothing is removed until the plugin ships.
 */
export interface DeprecatedTarget {
  /** The npm package that will replace the built-in target. */
  package: string;
}

/**
 * The 2.0 split as data (feature 036, T040): Antigravity (both harnesses) moves to the official plugin in `plugins/antigravity/`
 * (owner decision, spec 036 C-1); the long-tail targets keep working and are announced as moving once their plugin is published (C-4).
 * Always filled in, so docs, tests and the migration guide read one table.
 */
export const PLANNED_MOVED_TARGETS: Readonly<Record<string, MovedTarget>> = {
  antigravity: { package: "@ambystech/ambykit-emitter-antigravity", since: "2.0.0", displayName: "Antigravity (IDE)" },
  "antigravity-cli": { package: "@ambystech/ambykit-emitter-antigravity", since: "2.0.0", displayName: "Antigravity CLI" },
};

export const PLANNED_DEPRECATED_TARGETS: Readonly<Record<string, DeprecatedTarget>> = Object.fromEntries(
  ["gemini", "llxprt", "qwen", "kilo", "augment", "windsurf", "kiro"].map((id) => [id, { package: `@ambystech/ambykit-emitter-${id}` }]),
);

/**
 * THE SWITCH (spec 036, T040/T050). `false` while core still bundles the Antigravity emitters: a target in `MOVED_TARGETS` is treated
 * as "no longer bundled", so turning the planned moves on before the emitters are removed would tell users to install a plugin for a
 * target that still works. Task T050 removes the built-in Antigravity emitters from `TARGETS`, flips this to `true` in the same
 * commit, and updates the pinned test (test/plugins/moved-switch.test.ts). Nothing else reads this constant.
 */
export const SPLIT_ACTIVE = true;

/** What the commands consult. Empty until the switch is on; tests add entries to exercise the mechanism. */
export const MOVED_TARGETS: Record<string, MovedTarget> = SPLIT_ACTIVE ? { ...PLANNED_MOVED_TARGETS } : {};

export const DEPRECATED_TARGETS: Record<string, DeprecatedTarget> = SPLIT_ACTIVE ? { ...PLANNED_DEPRECATED_TARGETS } : {};

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

/**
 * One line per configured target that is still bundled but will move once its official plugin is published (feature 036, FR-002,
 * C-4). Nothing to do yet: the target keeps working and nothing is removed. Pure. Empty until the switch is on (`SPLIT_ACTIVE`).
 */
export function deprecatedTargetNotices(ids: readonly string[], map: Readonly<Record<string, DeprecatedTarget>> = DEPRECATED_TARGETS): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!Object.hasOwn(map, id)) continue;
    out.push(`Target '${id}' is bundled for now and will move to the plugin ${map[id]!.package} once it is published. It keeps working; nothing to do yet.`);
  }
  return out;
}

/**
 * For `init` and `add`: a requested target that moved to a plugin which is not available here (feature 036, FR-006, FR-010). One
 * message per target, the same install and config instructions as `sync`, and what to run after. The commands write nothing for it:
 * AmbyKit never installs a package or edits config on its own. Pure.
 */
export function movedTargetRefusals(
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
      `Target '${id}' is an official plugin now (${moved.package}, since ${moved.since}), so it is not added. Install it first: \`npm install --save-exact ${moved.package}\`, list it under "plugins" in .amby/config.json with that exact version, then run \`ambykit add ${id}\`.`,
    );
  }
  return out;
}

/**
 * Entries for the `init` and `add` pickers (feature 036, FR-010): each moved target that is not available here, marked as an
 * official plugin to install first. Empty when no target moved, so the pickers are unchanged. Pure.
 */
export function movedTargetChoices(
  known: (id: string) => boolean,
  map: Readonly<Record<string, MovedTarget>> = MOVED_TARGETS,
): { value: string; label: string }[] {
  return Object.entries(map)
    .filter(([id]) => !known(id))
    .map(([id, m]) => ({ value: id, label: `${m.displayName ?? id} (official plugin, install first: ${m.package})` }));
}
