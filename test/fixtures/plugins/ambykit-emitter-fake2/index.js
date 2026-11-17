// Object form: no AmbyKit import, validated by shape only.
const emitter = {
  toolId: "fake-twin",
  displayName: "Plain fixture",
  commandSurface: "commands",
  commandDir: ".faketwin/commands",
  emit(specs) {
    return specs.map((s) => ({ path: `.faketwin/commands/${s.name}.md`, contents: `# ${s.name}\n`, scope: "project" }));
  },
};
export default { targets: [{ id: "fake", displayName: "Plain fixture", emitter }] };
