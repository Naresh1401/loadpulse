/**
 * Shared types for the load balancer.
 */

export type BalancingStrategy = "round-robin" | "random" | "least-connections";

export interface BackendConfig {
  /** Base URL of the backend, e.g. "http://localhost:4001" */
  url: string;
  /** Relative path used for health checks. Defaults to "/" */
  healthPath?: string;
  /** Relative weight used by weighted strategies. Defaults to 1. */
  weight?: number;
}

export interface LoadBalancerConfig {
  /** Port the load balancer listens on. */
  port: number;
  /** Backend targets to distribute traffic across. */
  backends: BackendConfig[];
  /** Strategy used to pick the next backend. Defaults to "round-robin". */
  strategy?: BalancingStrategy;
  /** Interval (ms) between health checks. Defaults to 10000. Set to 0 to disable. */
  healthCheckIntervalMs?: number;
  /** Timeout (ms) for health check requests. Defaults to 2000. */
  healthCheckTimeoutMs?: number;
  /** Timeout (ms) for proxied requests before failing over. Defaults to 10000. */
  requestTimeoutMs?: number;
}

export interface BackendState {
  config: BackendConfig;
  healthy: boolean;
  activeConnections: number;
  totalRequests: number;
  totalFailures: number;
}
