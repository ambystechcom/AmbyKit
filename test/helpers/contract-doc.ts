/**
 * The contract document reader (feature 033, FR-001, SC-004). `docs/stability.md` holds fenced `contract` blocks, each a JSON object
 * that lists what one surface promises. The contract test reads them with this helper and checks every listed item against the code.
 */

/** One surface's promises. A list is optional; an unknown key is kept so a block can say more than the test reads. */
export interface ContractBlock {
  /** Which surface the block describes: `run`, `plugin` or `kit`. */
  surface: string;
  /** `--flag` names, with the leading dashes. */
  flags?: string[];
  /** Exit codes the surface may return. */
  exitCodes?: number[];
  /** Paths (relative to the project root) the surface reads or writes. */
  stateFiles?: string[];
  /** Exported runtime names. */
  exports?: string[];
  /** Exported type names (checked against the export lists in the source, as types have no runtime value). */
  exportTypes?: string[];
  [other: string]: unknown;
}

const FENCE = /^```contract[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm;

/** Every `contract` block of a markdown file, in order. A block that is not valid JSON, or has no `surface`, throws with its position. */
export function parseContractBlocks(markdown: string): ContractBlock[] {
  const blocks: ContractBlock[] = [];
  for (const m of markdown.matchAll(FENCE)) {
    const line = markdown.slice(0, m.index).split("\n").length;
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1]!);
    } catch (err) {
      throw new Error(`contract block at line ${line} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!parsed || typeof parsed !== "object" || typeof (parsed as { surface?: unknown }).surface !== "string") {
      throw new Error(`contract block at line ${line} needs a string \`surface\``);
    }
    blocks.push(parsed as ContractBlock);
  }
  return blocks;
}

/** The blocks of one surface, merged into one (lists are concatenated, in order, without duplicates). */
export function contractFor(blocks: ContractBlock[], surface: string): ContractBlock {
  const merged: ContractBlock = { surface };
  for (const b of blocks.filter((x) => x.surface === surface)) {
    for (const [key, value] of Object.entries(b)) {
      if (key === "surface") continue;
      if (Array.isArray(value)) {
        const have = (merged[key] as unknown[] | undefined) ?? [];
        merged[key] = [...have, ...value.filter((v) => !have.includes(v))];
      } else merged[key] = value;
    }
  }
  return merged;
}
