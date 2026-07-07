/**
 * Value objects for the terminal UI layer. All are plain and IO-free; the rendering functions in
 * this folder are pure over these + an injected `Capabilities`, so behavior is deterministic and
 * testable (constitution Principle 5). See specs/006-enhanced-tui/data-model.md.
 */

/** The single source of truth for terminal capabilities. Drives every degradation gate. */
export interface Capabilities {
  /** stdout is an interactive terminal. Gate for color + interactivity. */
  isTTY: boolean;
  /** Color allowed: `isTTY && !NO_COLOR && TERM≠dumb`. */
  color: boolean;
  /** Extended glyphs are safe; when false, the ASCII symbol set is used. */
  unicode: boolean;
  /** Terminal width in columns; defaults to 80 when unknown. */
  columns: number;
}

/** A glyph with a unicode form and an ASCII fallback, selected by `Capabilities.unicode`. */
export interface Glyph {
  u: string;
  a: string;
}

/** The resolved symbol set for the current capabilities (already unicode/ASCII-picked). */
export interface Symbols {
  success: string;
  warn: string;
  error: string;
  barFill: string;
  barEmpty: string;
  cursor: string;
  checked: string;
  unchecked: string;
  nextStep: string;
}

/** A view over a file-writing result for the US-3 change summary (built from fsops.WriteResult). */
export interface ChangeSummary {
  created: string[];
  updated: string[];
  unchanged: string[];
  skipped: string[];
  /** In dry-run mode, the files that would change (created/updated split is not computed). */
  wouldChange: string[];
  dryRun: boolean;
}

/** One column in a responsive table. */
export interface TableColumn {
  header: string;
  /** Minimum rendered width in characters before the column may be dropped. */
  min: number;
  /** Higher = kept longer; the lowest-priority columns drop first when width is tight. */
  priority: number;
}

/** A progress cell renders as a bar + percent. */
export interface ProgressCell {
  done: number;
  total: number;
}

/** A status cell renders the status word in its status-specific color. */
export interface StatusCell {
  status: string;
}

/** A plain string renders as text; the object cells render specially. */
export type Cell = string | ProgressCell | StatusCell;

/** A table to fit within `width` columns. */
export interface TableModel {
  columns: TableColumn[];
  rows: Cell[][];
  width: number;
}

export type MenuMode = "list" | "detail" | "done";

/** State for the interactive menu/prompt reducers (US-6/US-7). Reducer is `(state, key) → state`. */
export interface MenuState<T> {
  items: T[];
  /** Highlighted index. */
  cursor: number;
  /** Multi-select set (unused by single-select navigation). */
  selected: Set<number>;
  mode: MenuMode;
}
