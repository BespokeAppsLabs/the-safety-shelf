// Barrel → api.agentPrompts.*
// No "use node" functions live in this domain, so mixing queries/mutations
// here is safe (the bundler bug only bites when a barrel mixes isolate and
// node-environment functions — see convex/aiCredentials.ts for that story).
export { getActive } from "./agentPrompts/queries/getActive";
export { list } from "./agentPrompts/queries/list";
export { create } from "./agentPrompts/mutations/create";
export { activate } from "./agentPrompts/mutations/activate";
