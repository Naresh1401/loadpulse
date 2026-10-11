import type { BackendState, BalancingStrategy } from "./types.js";

/**
 * Picks the next healthy backend to route a request to, based on the
 * configured strategy. Returns `undefined` when no backend is healthy.
 */
export function pickBackend(
  backends: BackendState[],
  strategy: BalancingStrategy,
  roundRobinCursor: { index: number }
): BackendState | undefined {
  const healthy = backends.filter((b) => b.healthy);
  if (healthy.length === 0) return undefined;

  switch (strategy) {
    case "random":
      return healthy[Math.floor(Math.random() * healthy.length)];

    case "least-connections":
      return healthy.reduce((best, current) =>
        current.activeConnections < best.activeConnections ? current : best
      );

    case "round-robin":
    default: {
      roundRobinCursor.index = roundRobinCursor.index % healthy.length;
      const chosen = healthy[roundRobinCursor.index];
      roundRobinCursor.index += 1;
      return chosen;
    }
  }
}
