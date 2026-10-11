/**
 * Shared types for the benchmarking / load-testing engine.
 */

export interface BenchOptions {
  /** Fully-qualified URL of the deployed endpoint to test. */
  url: string;
  /** HTTP method to use. Defaults to "GET". */
  method?: string;
  /** Extra headers to send with every request. */
  headers?: Record<string, string>;
  /** Request body, sent as-is (already serialized). */
  body?: string;
  /** Number of concurrent "workers" firing requests. Defaults to 10. */
  concurrency?: number;
  /** Total number of requests to send. Mutually exclusive with `durationMs`. */
  requests?: number;
  /** Duration (ms) to keep sending requests. Mutually exclusive with `requests`. */
  durationMs?: number;
  /** Per-request timeout (ms). Defaults to 10000. */
  timeoutMs?: number;
}

export interface RequestSample {
  ok: boolean;
  status: number;
  latencyMs: number;
  error?: string;
}

export interface BenchResult {
  url: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  durationMs: number;
  requestsPerSecond: number;
  latency: {
    minMs: number;
    maxMs: number;
    meanMs: number;
    p50Ms: number;
    p90Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  statusCodeCounts: Record<string, number>;
}
