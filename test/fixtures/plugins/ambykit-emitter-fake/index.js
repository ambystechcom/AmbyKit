export default function (api) {
  class Emitter extends api.BaseEmitter {
    toolId = "fake";
    displayName = "fake fixture";
    commandSurface = "commands";
    commandDir = ".fake/commands";
    commandFrontmatter(spec) {
      return [["description", this.yamlQuote(spec.description)]];
    }
  }
  return { targets: [{ id: "fake", displayName: "Fake fixture", emitter: new Emitter() }] };
}
