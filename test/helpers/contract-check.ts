import type { ContractBlock } from "./contract-doc.js";
import { contractFor } from "./contract-doc.js";

/**
 * Checks a contract document against facts gathered from the code (feature 033, FR-013, SC-004). The facts are built once by
 * `test/stability-contract.test.ts` from the real command, a real fake-assistant run, the real loader and the real exports; this
 * function only compares. A listed item with no check is a failure, so a promise cannot be added without a test (Principle 5);
 * an item the code has that the document does not list is not checked (FR-002: unlisted things are not covered).
 */

export interface PluginProbe {
  /** Did a plugin with this loading-rule violation get refused (true) or loaded (false)? */
  refused(rule: string): boolean | undefined;
  /** The problems `validateShape` reports when a descriptor key is removed; empty when the key is not required. */
  descriptorKeyRequired(path: string): boolean | undefined;
}

export interface Facts {
  /** `ambykit run`'s usage line. */
  usage: string;
  /** Every exit code a probe observed from `run`. */
  observedExitCodes: Set<number>;
  /** Output of a real (fake-assistant) run. */
  runOutput: string;
  /** Files under `.amby/fleet/` after that run, a directive and a fleet record, with ids replaced by `<run>`, `<lane>`, `<fleet>`. */
  stateFiles: Set<string>;
  /** The actions a directive may carry, and the keys of a written directive. */
  directiveActions: string[];
  directiveKeys: string[];
  /** Runtime export names and type export names of the plugin entry, the test kit and the library entry. */
  exports: Record<"plugin" | "kit", { values: Set<string>; types: Set<string> }>;
  plugin: PluginProbe;
}

const DOC_ONLY = new Set(["surface", "note", "notes"]);

/** `Run plan for <feature> — run <run>` becomes a regular expression where each `<token>` matches any text. */
function printedPattern(text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(/<[a-z-]+>/g, ".+"));
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

/** Every difference between what the document lists and what the code does. Empty means the document and the code agree. */
export function checkContract(blocks: ContractBlock[], facts: Facts): string[] {
  const failures: string[] = [];
  const known = {
    run: new Set(["subcommands", "flags", "exitCodes", "stateFiles", "printed", "directiveActions", "directiveFields"]),
    plugin: new Set(["exports", "exportTypes", "descriptor", "loadingRules"]),
    kit: new Set(["exports", "exportTypes"]),
  };

  for (const surface of ["run", "plugin", "kit"] as const) {
    const c = contractFor(blocks, surface);
    for (const key of Object.keys(c)) {
      if (!DOC_ONLY.has(key) && !known[surface].has(key)) failures.push(`${surface}: no check for the key '${key}'`);
    }
    if (surface === "run") {
      for (const f of strings(c["flags"])) if (!facts.usage.includes(f)) failures.push(`run flag ${f} is not in the usage`);
      for (const s of strings(c["subcommands"])) if (!facts.usage.includes(s)) failures.push(`run subcommand ${s} is not in the usage`);
      for (const code of (c["exitCodes"] as number[] | undefined) ?? []) {
        if (!facts.observedExitCodes.has(code)) failures.push(`run exit code ${code} was not observed by any probe`);
      }
      for (const file of strings(c["stateFiles"])) if (!facts.stateFiles.has(file)) failures.push(`run state file ${file} was not written`);
      for (const line of strings(c["printed"])) if (!printedPattern(line).test(facts.runOutput)) failures.push(`run did not print '${line}'`);
      for (const a of strings(c["directiveActions"])) if (!facts.directiveActions.includes(a)) failures.push(`directive action ${a} is not accepted`);
      for (const k of strings(c["directiveFields"])) if (!facts.directiveKeys.includes(k)) failures.push(`a directive has no field ${k}`);
    } else {
      const ex = facts.exports[surface];
      for (const name of strings(c["exports"])) if (!ex.values.has(name)) failures.push(`${surface} export ${name} is missing`);
      for (const name of strings(c["exportTypes"])) if (!ex.types.has(name)) failures.push(`${surface} type export ${name} is missing`);
    }
    if (surface === "plugin") {
      for (const path of strings(c["descriptor"])) {
        const required = facts.plugin.descriptorKeyRequired(path);
        if (required === undefined) failures.push(`plugin descriptor key ${path} has no check`);
        else if (!required) failures.push(`plugin descriptor key ${path} is not required by the loader`);
      }
      for (const rule of strings(c["loadingRules"])) {
        const refused = facts.plugin.refused(rule);
        if (refused === undefined) failures.push(`plugin loading rule ${rule} has no check`);
        else if (!refused) failures.push(`plugin loading rule ${rule} is not enforced`);
      }
    }
  }
  return failures;
}
