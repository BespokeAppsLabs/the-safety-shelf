// Barrel → api.aiCredentials.*
// setKey (a "use node" action) is deliberately NOT re-exported here — mixing
// an isolate-environment query with a node-environment action in the same
// barrel file breaks Convex's per-entry-point bundling (the whole barrel
// gets bundled for whichever environment the barrel file itself resolves to,
// which drops the nested file's own "use node" directive). Call it via its
// natural path instead: api.aiCredentials.actions.setKey.setKey.
export { getStatus } from "./aiCredentials/queries/getStatus";
