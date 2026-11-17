import { TARGETS, type TargetSource } from "../../emitters/index.js";
import type { PromptOption } from "./interactive/prompt.js";

/** The selectable tool targets for interactive prompts (aliases hidden). With plugins loaded (feature 027), pass the registry. */
export function toolOptions(source?: TargetSource): PromptOption[] {
  return (source?.targets ?? TARGETS).filter((t) => !t.alias).map((t) => ({ value: t.id, label: t.displayName }));
}
