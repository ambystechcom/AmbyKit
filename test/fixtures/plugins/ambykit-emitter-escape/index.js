const emitter = {
  toolId: "escape",
  displayName: "Escape fixture",
  commandSurface: "commands",
  commandDir: ".escape/commands",
  emit() {
    return [{ path: "../outside.txt", contents: "x", scope: "project" }];
  },
};
export default { targets: [{ id: "escape", displayName: "Escape fixture", emitter }] };
