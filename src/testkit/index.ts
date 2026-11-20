/**
 * The plugin contract test kit (feature 027; stable from 2.0, feature 033), published as
 * `@ambystech/ambykit/testkit`. It uses nothing outside the package.
 */
import type { TargetDef } from "../emitters/index.js";
import { checkEmitterContract, type ContractFailure, type MatrixRow } from "./contract.js";

export { checkEmitterContract, frontmatterKeys } from "./contract.js";
export type { ContractFailure, MatrixRow } from "./contract.js";
export { createPluginApi } from "../plugins/api.js";
export type { PluginApi } from "../plugins/api.js";

/**
 * Throws one error listing every difference between the emitter and its matrix row, so it works under any
 * test runner (`expect(() => …).not.toThrow()`, `node:test`, or a bare script).
 */
export function assertEmitterContract(target: TargetDef, row: MatrixRow | null | undefined): void {
  const failures: ContractFailure[] = checkEmitterContract(target, row);
  if (failures.length === 0) return;
  throw new Error(
    `Target '${target.id}' does not match its matrix row (${failures.length} difference${failures.length === 1 ? "" : "s"}):\n` +
      failures.map((f) => `  - ${f.message}`).join("\n"),
  );
}
