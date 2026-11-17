const emitter = {
  toolId: "userscope",
  displayName: "User-scope fixture",
  commandSurface: "commands",
  commandDir: ".userscope/commands",
  emit() {
    return [
      { path: ".userscope/commands/a.md", contents: "a\n", scope: "project" },
      { path: ".userscope/global.json", contents: "{}\n", scope: "user" },
    ];
  },
};
export default { targets: [{ id: "userscope", displayName: "User-scope fixture", emitter }] };
