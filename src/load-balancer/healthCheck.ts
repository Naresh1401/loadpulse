import type { BackendState } from "./types.js";

/**
 * Runs a single health check pass against every backend and mutates
 * `backend.healthy` in place based on the outcome.
 */
export async function checkBackendHealth(
  backend: BackendState,
  timeoutMs: number
): Promise<void> {
  const healthPath = backend.config.healthPath ?? "/";
  const url = new URL(healthPath, backend.config.url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    backend.healthy = res.status < 500;
  } catch {
    backend.healthy = false;
  } finally {
    clearTimeout(timer);
  }
}

export function startHealthChecks(
  backends: BackendState[],
  intervalMs: number,
  timeoutMs: number
): () => void {
  if (intervalMs <= 0) {
    return () => {};
  }

  // Run an immediate check so the balancer doesn't start blind, then poll.
  void Promise.all(backends.map((b) => checkBackendHealth(b, timeoutMs)));

  const timer = setInterval(() => {
    void Promise.all(backends.map((b) => checkBackendHealth(b, timeoutMs)));
  }, intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}
