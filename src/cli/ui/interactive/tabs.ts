/**
 * Tab slice (feature 032, US-1/US-2): the four dashboard tabs and the pure moves between them. Rendering the tab bar
 * waits for the signed-off design; this is only the state. Unknown input is a no-op (FR-004).
 */

export const TABS = ["overview", "fleet", "graph", "quality"] as const;
export type Tab = (typeof TABS)[number];

export function nextTab(t: Tab): Tab {
  return TABS[(TABS.indexOf(t) + 1) % TABS.length]!;
}

export function prevTab(t: Tab): Tab {
  return TABS[(TABS.indexOf(t) + TABS.length - 1) % TABS.length]!;
}

/** The tab for a typed key `1`-`4`; null for anything else. */
export function tabByNumber(key: string | undefined): Tab | null {
  if (key === undefined || !/^[1-4]$/.test(key)) return null;
  return TABS[Number(key) - 1]!;
}

/** Tab keys: `1`-`4` jump, `]` next, `[` previous. Returns the target tab or null when the key is not a tab key. */
export function tabForKey(current: Tab, key: { sequence?: string; name?: string }): Tab | null {
  const seq = key.sequence;
  if (seq === "]") return nextTab(current);
  if (seq === "[") return prevTab(current);
  return tabByNumber(seq);
}
