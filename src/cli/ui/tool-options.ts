import { TARGETS } from "../../emitters/index.js";
import type { PromptOption } from "./interactive/prompt.js";

/** The selectable tool targets for interactive prompts (aliases hidden). */
export function toolOptions(): PromptOption[] {
  return TARGETS.filter((t) => !t.alias).map((t) => ({ value: t.id, label: t.displayName }));
}
