export const AGENT_RUN_TIMEOUT_MS = 10 * 60 * 1000;

export function isAgentRunActive(runId?: string, startedAt?: number, now = Date.now()) {
  return Boolean(runId && startedAt && now - startedAt < AGENT_RUN_TIMEOUT_MS);
}
