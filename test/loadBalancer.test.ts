import { describe, expect, it, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createLoadBalancer } from "../src/load-balancer/index.js";
import type { LoadBalancerHandle } from "../src/load-balancer/index.js";

function startBackend(id: string, port: number): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200);
        res.end("ok");
        return;
      }
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(id);
    });
    server.listen(port, () => resolve(server));
  });
}

describe("createLoadBalancer", () => {
  let backendA: http.Server;
  let backendB: http.Server;
  let lb: LoadBalancerHandle;
  const lbPort = 8099;
  const portA = 4101;
  const portB = 4102;

  beforeAll(async () => {
    backendA = await startBackend("A", portA);
    backendB = await startBackend("B", portB);
    lb = createLoadBalancer({
      port: lbPort,
      strategy: "round-robin",
      healthCheckIntervalMs: 0,
      backends: [{ url: `http://localhost:${portA}` }, { url: `http://localhost:${portB}` }],
    });
    await new Promise((resolve) => lb.server.once("listening", resolve));
  });

  afterAll(async () => {
    await lb.close();
    await new Promise((resolve) => backendA.close(resolve));
    await new Promise((resolve) => backendB.close(resolve));
  });

  it("distributes requests across backends in round-robin order", async () => {
    const results: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await fetch(`http://localhost:${lbPort}/`);
      results.push(await res.text());
    }
    expect(results).toEqual(["A", "B", "A", "B"]);
  });

  it("returns 503 when no backends are healthy", async () => {
    for (const backend of lb.backends) backend.healthy = false;
    const res = await fetch(`http://localhost:${lbPort}/`);
    expect(res.status).toBe(503);
    for (const backend of lb.backends) backend.healthy = true;
  });
});
