import { BaseCommand, flag, type CliOptions } from "./base-command.js";
import { readFeatures } from "../core/features.js";
import { buildGraph } from "../core/graph.js";
import { toJson, toMermaid, toText } from "../core/graph-format.js";
import { scopeToFeature } from "../core/graph-scope.js";

/**
 * Print the shared story/feature dependency graph (feature 023). Local, zero model tokens. Reads the
 * specs visible from where it runs, builds the graph once through `buildGraph`, and formats it as
 * text (default), `--json` or `--mermaid`. Broken edges and cycles are listed first and make the
 * command exit non-zero, so CI can gate on it (FR-010).
 */
export class GraphCommand extends BaseCommand {
  readonly name = "graph";
  readonly summary = "Print the story and feature dependency graph (text, --json or --mermaid).";
  readonly usage = "ambykit graph [feature] [--json | --mermaid]";

  protected async execute(opts: CliOptions): Promise<number> {
    const root = this.projectRoot(opts.cwd);
    const { features } = readFeatures(root);
    let graph = buildGraph(features);

    const target = opts.positionals[0];
    if (target !== undefined) {
      const scoped = scopeToFeature(graph, target);
      if (scoped === null) {
        this.error(`No feature matches "${target}".`, "Use a feature number or directory name, e.g. `ambykit graph 023`.");
        return 1;
      }
      graph = scoped;
    }

    if (flag(opts, "json")) this.info(JSON.stringify(toJson(graph), null, 2));
    else if (flag(opts, "mermaid")) this.info(toMermaid(graph));
    else if (graph.nodes.length === 0) this.info("No user stories found.");
    else this.info(toText(graph));

    return graph.broken.length > 0 || graph.cycles.length > 0 ? 1 : 0;
  }
}
