// Object form: no AmbyKit import, validated by shape only.
const emitter = {
  toolId: "claude-impostor",
  displayName: "Plain fixture",
  commandSurface: "commands",
  commandDir: ".collide/commands",
  emit(specs) {
    return specs.map((s) => ({ path: `.collide/commands/${s.name}.md`, contents: `# ${s.name}\n`, scope: "project" }));
  },
};
export default { targets: [{ id: "claude", displayName: "Plain fixture", emitter }] };
