// A worked AmbyKit emitter plugin (feature 027). The plugin API is stable from 2.0.
//
// A plugin's default export is a factory. AmbyKit calls it with the extension points, so the classes you
// subclass always come from the running copy of AmbyKit (never a second install next to your package).
// It returns the targets the plugin adds. This one adds three, one per extension point:
//
//   example        BaseEmitter         Markdown commands with YAML frontmatter
//   example-skills SkillsEmitter       one SKILL.md per phase
//   example-toml   TomlCommandEmitter  TOML commands with a `prompt` string
//
// The paths and frontmatter keys here are INVENTED for the example. A real plugin takes them from the
// host's own documentation and records them as a matrix row (see matrix-rows.json and docs/plugin-api.md).

export default function (api) {
  class ExampleEmitter extends api.BaseEmitter {
    toolId = "example";
    displayName = "Example assistant";
    commandSurface = "commands";
    commandDir = ".example/commands";

    // The ordered [key, value] pairs of the YAML frontmatter. `yamlQuote` makes a value safe YAML.
    commandFrontmatter(spec) {
      return [["description", this.yamlQuote(spec.description)]];
    }
  }

  // SkillsEmitter fixes the layout `<commandDir>/<skill name>/SKILL.md` with `name` and `description`.
  class ExampleSkillsEmitter extends api.SkillsEmitter {
    toolId = "example-skills";
    displayName = "Example assistant (skills)";
    commandDir = ".example/skills";
  }

  // TomlCommandEmitter fixes the TOML shape: `description` and a multi-line `prompt`.
  class ExampleTomlEmitter extends api.TomlCommandEmitter {
    toolId = "example-toml";
    displayName = "Example assistant (TOML)";
    commandDir = ".example/toml";
  }

  return {
    targets: [
      { id: "example", displayName: "Example assistant", emitter: new ExampleEmitter() },
      { id: "example-skills", displayName: "Example assistant (skills)", emitter: new ExampleSkillsEmitter() },
      { id: "example-toml", displayName: "Example assistant (TOML)", emitter: new ExampleTomlEmitter() },
    ],
  };
}
