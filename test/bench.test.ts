import { describe, expect, it, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { runBenchmark } from "../src/bench/index.js";

describe("runBenchmark", () => {
  let server: http.Server;
  const port = 4201;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(port, resolve));
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("sends the requested number of requests and reports stats", async () => {
    const result = await runBenchmark({
      url: `http://localhost:${port}/`,
      requests: 20,
      concurrency: 5,
    });

    expect(result.totalRequests).toBe(20);
    expect(result.successCount).toBe(20);
    expect(result.failureCount).toBe(0);
    expect(result.statusCodeCounts["200"]).toBe(20);
    expect(result.latency.p50Ms).toBeGreaterThanOrEqual(0);
    expect(result.requestsPerSecond).toBeGreaterThan(0);
  });

  it("records failures for unreachable hosts", async () => {
    const result = await runBenchmark({
      url: "http://localhost:1/unreachable",
      requests: 3,
      concurrency: 3,
      timeoutMs: 500,
    });

    expect(result.totalRequests).toBe(3);
    expect(result.failureCount).toBe(3);
    expect(result.statusCodeCounts.error).toBe(3);
  });
});
