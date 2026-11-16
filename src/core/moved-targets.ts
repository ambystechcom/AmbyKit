/**
 * Targets that moved out of the core into an official plugin (feature 027, FR-014). A project that still
 * lists such a target gets a notice naming the package to install; nothing it already wrote is removed.
 *
 * Empty in 1.6: no built-in target is extracted yet. The mechanism ships first, and the first extraction
 * follows once the API has been used (`docs/plugin-split.md`, plan open decision 3). When a target moves,
 * add `"<id>": { package: "ambykit-emitter-<id>", since: "<release>" }` here and drop it from `TARGETS`.
 */
export interface MovedTarget {
  /** The npm package that now provides the target. */
  package: string;
  /** The AmbyKit release that stopped bundling it. */
  since: string;
}

export const MOVED_TARGETS: Record<string, MovedTarget> = {};

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
