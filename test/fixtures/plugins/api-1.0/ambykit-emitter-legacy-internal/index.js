// A 1.x plugin that reached into an internal module for a name the API did not export: it cannot be imported under the
// package's exports map, and the loader says which name it relied on.
import { MCP_COMMAND } from "@ambystech/ambykit/dist/emitters/base-emitter.js";
export default { targets: [{ id: "legacy-internal", displayName: "Legacy internal", emitter: { toolId: MCP_COMMAND } }] };
