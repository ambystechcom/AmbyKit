# Notes

- Node: v24.4.0 (repo requires >= 20). `npm run build` ok.
- `node -e "import('./dist/core/dashboard.js')"` works from a plain `.mjs`/`-e`; exports used by the
  spike: `parseStories`, `parseTasks`, `parseDeclaredPaths`, `canonicalStoryId`; from `dist/core/markers.js`:
  `parsePhases`, `parseMarkers`, `phaseNumber`; from `dist/core/lanes.js`: `mergeCheckoffs`.
- `gray-matter` (already a runtime dependency) imports from a spike script because the repo's
  `node_modules` resolves from `spikes/`. Its YAML engine is `matter.engines.yaml.parse`. No new dependency.
- Token cost is approximated as characters / 4 (no tokenizer dependency, per plan open decision 2).
