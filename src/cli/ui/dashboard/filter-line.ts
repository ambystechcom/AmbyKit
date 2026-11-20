import type { Filters } from "../../../core/overview-types.js";
import { filterText, noMatchText, type ListFilter } from "../interactive/list-filter.js";

/**
 * Plain-text filter line and no-match message (feature 032, US-3, FR-006): what is applied and how to clear it, with
 * no colour or glyph so it reads the same on every terminal. The overview keeps its own pinned `[feature=… status=…]`
 * note; this is the text for the lists that gain a filter (stories, lanes).
 */

/** The overview's filters as a list filter: the feature text is the search, the status is the state. */
export function fromFilters(f: Filters): ListFilter {
  return { query: f.feature ?? "", ...(f.status !== undefined ? { state: f.status } : {}) };
}

/** `filter: search: "auth" · state: blocked   (esc to clear)`, or "" when nothing is applied. */
export function filterLine(f: ListFilter): string {
  const text = filterText(f);
  return text ? `filter: ${text}   (esc to clear)` : "";
}

/** What to show instead of an empty list when the filter hides everything. */
export function noMatchMessage(f: ListFilter): string {
  return noMatchText(f);
}
