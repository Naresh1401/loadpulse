import type { BenchOptions, BenchResult, RequestSample } from "./types.js";

function percentile(sortedLatencies: number[], p: number): number {
  if (sortedLatencies.length === 0) return 0;
  const index = Math.min(
    sortedLatencies.length - 1,
    Math.ceil((p / 100) * sortedLatencies.length) - 1
  );
  return sortedLatencies[Math.max(index, 0)];
}

async function sendOne(options: BenchOptions): Promise<RequestSample> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  const start = performance.now();

  try {
    const res = await fetch(options.url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
    // Drain the body so the connection can be reused / closed cleanly.
    await res.arrayBuffer().catch(() => undefined);
    const latencyMs = performance.now() - start;
    return { ok: res.ok, status: res.status, latencyMs };
  } catch (err) {
    const latencyMs = performance.now() - start;
    return {
      ok: false,
      status: 0,
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs a concurrent load test against `options.url`, bounded by either a
 * total request count or a wall-clock duration, and returns aggregated
 * latency/throughput statistics.
 */
export async function runBenchmark(options: BenchOptions): Promise<BenchResult> {
  if (!options.requests && !options.durationMs) {
    throw new Error("Either `requests` or `durationMs` must be specified");
  }

  const concurrency = options.concurrency ?? 10;
  const samples: RequestSample[] = [];
  const deadline = options.durationMs ? Date.now() + options.durationMs : undefined;
  const maxRequests = options.requests ?? Infinity;

  const start = performance.now();
  let dispatched = 0;

  async function worker(): Promise<void> {
    while (dispatched < maxRequests && (!deadline || Date.now() < deadline)) {
      dispatched += 1;
      const sample = await sendOne(options);
      samples.push(sample);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, maxRequests) }, () => worker());
  await Promise.all(workers);

  const totalDurationMs = performance.now() - start;
  const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const successCount = samples.filter((s) => s.ok).length;

  const statusCodeCounts: Record<string, number> = {};
  for (const sample of samples) {
    const key = sample.status === 0 ? "error" : String(sample.status);
    statusCodeCounts[key] = (statusCodeCounts[key] ?? 0) + 1;
  }

  return {
    url: options.url,
    totalRequests: samples.length,
    successCount,
    failureCount: samples.length - successCount,
    durationMs: totalDurationMs,
    requestsPerSecond: samples.length / (totalDurationMs / 1000),
    latency: {
      minMs: latencies[0] ?? 0,
      maxMs: latencies[latencies.length - 1] ?? 0,
      meanMs: latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1),
      p50Ms: percentile(latencies, 50),
      p90Ms: percentile(latencies, 90),
      p95Ms: percentile(latencies, 95),
      p99Ms: percentile(latencies, 99),
    },
    statusCodeCounts,
  };
}
