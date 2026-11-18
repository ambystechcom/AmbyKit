import type { DashboardIcons } from "../../core/types.js";

/**
 * Icon-set resolution (feature 029, FR-011). Pure: `--icons` flag, then the `AMBYKIT_ICONS` environment value,
 * then `dashboard.icons` in the project config, then auto-detection. `auto`, an absent value and an
 * unrecognised value each fall through to the next level (a bad env or config value never fails the
 * dashboard). Nerd Font glyphs cannot be detected, so `auto` never picks them. A terminal without unicode
 * always gets ASCII, whatever was asked for, as before (feature 017).
 */

export type IconMode = "nerd" | "unicode" | "ascii";
export type IconSource = "flag" | "env" | "config" | "auto";

export interface IconInput {
  flag?: string | undefined;
  env?: string | undefined;
  config?: DashboardIcons | string | undefined;
  caps: { unicode: boolean };
}

const MODES: readonly string[] = ["nerd", "unicode", "ascii"];

function pick(value: string | undefined): IconMode | null {
  const v = value?.trim().toLowerCase();
  return v && MODES.includes(v) ? (v as IconMode) : null;
}

export function resolveIconMode(input: IconInput): { mode: IconMode; source: IconSource } {
  const levels: [IconSource, IconMode | null][] = [
    ["flag", pick(input.flag)],
    ["env", pick(input.env)],
    ["config", pick(input.config)],
  ];
  const hit = levels.find(([, m]) => m !== null);
  const source: IconSource = hit ? hit[0] : "auto";
  const wanted: IconMode = hit ? (hit[1] as IconMode) : "unicode";
  return { mode: input.caps.unicode ? wanted : "ascii", source };
}
