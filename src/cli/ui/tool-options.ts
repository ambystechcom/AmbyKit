import { movedTargetChoices } from "../../core/moved-targets.js";
import { getTarget, TARGETS, type TargetSource } from "../../emitters/index.js";
import type { PromptOption } from "./interactive/prompt.js";

/**
 * The selectable tool targets for interactive prompts (aliases hidden). With plugins loaded (feature 027), pass the registry.
 * Targets that moved to an official plugin and are not available here are listed last, marked "official plugin, install first"
 * (feature 036, FR-010); choosing one is refused with the install lines. With no moved target the list is exactly the registry's.
 */
export function toolOptions(source?: TargetSource): PromptOption[] {
  const available = (source?.targets ?? TARGETS).filter((t) => !t.alias).map((t) => ({ value: t.id, label: t.displayName }));
  return [...available, ...movedTargetChoices((id) => getTarget(id, source) !== undefined)];
}
