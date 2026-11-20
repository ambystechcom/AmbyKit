// Written for the 1.0 plugin API, object form: no AmbyKit import, validated by shape only.
const emitter = {
  toolId: "legacy-object",
  displayName: "Legacy object",
  commandSurface: "commands",
  commandDir: ".legacy-object/commands",
  emit(specs) {
    return specs.map((s) => ({ path: `.legacy-object/commands/${s.name}.md`, contents: `# ${s.name}\n`, scope: "project" }));
  },
};
export default { targets: [{ id: "legacy-object", displayName: "Legacy object", emitter }] };
