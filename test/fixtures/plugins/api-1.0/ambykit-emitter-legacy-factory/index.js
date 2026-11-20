// Written for the 1.0 plugin API, factory form: only the 1.0 extension points (BaseEmitter and the factory's api argument).
export default function (api) {
  class Emitter extends api.BaseEmitter {
    toolId = "legacy-factory";
    displayName = "Legacy factory";
    commandSurface = "commands";
    commandDir = ".legacy-factory/commands";
    commandFrontmatter(spec) {
      return [["description", this.yamlQuote(spec.description)]];
    }
  }
  return { targets: [{ id: "legacy-factory", displayName: "Legacy factory", emitter: new Emitter() }] };
}
