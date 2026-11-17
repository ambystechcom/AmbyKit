// Object form: no AmbyKit import, validated by shape only.
const emitter = {
  toolId: "plain",
  displayName: "Plain fixture",
  commandSurface: "commands",
  commandDir: ".plain/commands",
  emit(specs) {
    return specs.map((s) => ({ path: `.plain/commands/${s.name}.md`, contents: `# ${s.name}\n`, scope: "project" }));
  },
};
export default { targets: [{ id: "plain", displayName: "Plain fixture", emitter }] };
