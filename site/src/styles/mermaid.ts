/**
 * Build Mermaid `themeVariables` from the ambystech CSS custom properties for the current theme, so
 * diagrams re-theme live in light/dark (FR-007). Consumed by the Diagram component (US-3).
 */
export function mermaidThemeVariables(): Record<string, string> {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string): string => css.getPropertyValue(name).trim();
  return {
    // node
    primaryColor: v("--ak-surface-elevated"),
    primaryBorderColor: v("--ak-brand"),
    primaryTextColor: v("--ak-text"),
    // edges + labels
    lineColor: v("--ak-accent-orchid"),
    edgeLabelBackground: v("--ak-surface"),
    // clusters
    clusterBkg: v("--ak-mermaid-cluster-bg"),
    clusterBorder: v("--ak-border"),
    // misc
    fontFamily: "system-ui, sans-serif",
    background: v("--ak-surface"),
  };
}
