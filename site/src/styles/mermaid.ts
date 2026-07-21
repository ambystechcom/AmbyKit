/**
 * Build Mermaid `themeVariables` from the ambystech CSS custom properties for the current theme, so
 * diagrams re-theme live in light/dark (FR-007). Consumed by the Diagram component (US-3).
 */
/**
 * Per-node-kind styling, injected into each rendered SVG. Kept here (not in `classDef` inside the
 * diagram source) for two reasons: `classDef` values are static text, so they cannot follow the
 * light/dark toggle, and this reads the live CSS vars every render.
 *
 * The three kinds map onto the signature gradient — brand magenta for the required spine, orchid for
 * once-per-project governance, sky for the as-needed phases, whose dashed outline echoes the dotted
 * edges that connect them. Fills stay on the surface tokens so label text keeps its contrast in both
 * modes; only the outline carries the meaning.
 */
export function mermaidThemeCSS(): string {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string): string => css.getPropertyValue(name).trim();
  const shape = "rect, path, polygon, circle, ellipse";
  const kinds: [string, string, string][] = [
    ["spine", v("--ak-brand"), ""],
    ["gov", v("--ak-accent-orchid"), ""],
    ["opt", v("--ak-accent-sky"), "stroke-dasharray: 5 4;"],
  ];
  return kinds
    .map(
      ([kind, stroke, extra]) =>
        `.node.${kind} :is(${shape}) { stroke: ${stroke}; ${extra} }`,
    )
    .join("\n");
}

export function mermaidThemeVariables(): Record<string, string> {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string): string => css.getPropertyValue(name).trim();
  return {
    // node
    primaryColor: v("--ak-surface-elevated"),
    primaryBorderColor: v("--ak-brand"),
    primaryTextColor: v("--ak-text"),
    // edges + labels. `textColor` covers edge labels, which sit on the diagram background.
    lineColor: v("--ak-accent-orchid"),
    edgeLabelBackground: v("--ak-surface"),
    textColor: v("--ak-text"),
    // clusters
    clusterBkg: v("--ak-mermaid-cluster-bg"),
    clusterBorder: v("--ak-border"),
    // misc. Mermaid's base theme defaults to a small label size; set it explicitly so node and
    // edge text stays readable at the diagram's natural size.
    fontFamily: "system-ui, sans-serif",
    fontSize: "16px",
    background: v("--ak-surface"),
  };
}
