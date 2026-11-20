/**
 * List filter slice (feature 032, US-3): `{query, state}` over features, stories and lanes. Pure; the active filter is
 * a string the renderer shows, so a person always sees what is applied (FR-006).
 */

export interface ListFilter {
  /** Text or ID search; empty means no search. Case-insensitive, matches id or title. */
  query: string;
  /** A state such as `blocked`, `in-progress` or `done`; undefined means every state. */
  state?: string;
}

export interface Filterable {
  id: string;
  title?: string;
  state?: string;
}

export const NO_FILTER: ListFilter = { query: "" };

export function isActive(f: ListFilter): boolean {
  return f.query.trim() !== "" || f.state !== undefined;
}

export function matches(item: Filterable, f: ListFilter): boolean {
  const q = f.query.trim().toLowerCase();
  if (q && !item.id.toLowerCase().includes(q) && !(item.title ?? "").toLowerCase().includes(q)) return false;
  if (f.state !== undefined && item.state !== f.state) return false;
  return true;
}

export function applyListFilter<T extends Filterable>(items: readonly T[], f: ListFilter): T[] {
  return isActive(f) ? items.filter((i) => matches(i, f)) : [...items];
}

/** The next state in `cycle` after the current one; the cycle's first entry stands for "every state" (undefined). */
export function cycleState(f: ListFilter, cycle: readonly (string | undefined)[]): ListFilter {
  const i = cycle.indexOf(f.state);
  return { ...f, state: cycle[(i + 1) % cycle.length] };
}

/** `search: "auth" · state: blocked`, or "" when nothing is applied. */
export function filterText(f: ListFilter): string {
  const parts: string[] = [];
  if (f.query.trim()) parts.push(`search: "${f.query.trim()}"`);
  if (f.state !== undefined) parts.push(`state: ${f.state}`);
  return parts.join(" · ");
}

/** What to say when the filter hides everything, with how to clear it. */
export function noMatchText(f: ListFilter): string {
  return `Nothing matches ${filterText(f)}. Press esc to clear the filter.`;
}
