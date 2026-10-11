import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { BackendConfig, BackendState, LoadBalancerConfig } from "./types.js";
import { pickBackend } from "./strategies.js";
import { startHealthChecks } from "./healthCheck.js";

export interface LoadBalancerHandle {
  server: http.Server;
  backends: BackendState[];
  close: () => Promise<void>;
}

function toBackendState(config: BackendConfig): BackendState {
  return {
    config,
    healthy: true,
    activeConnections: 0,
    totalRequests: 0,
    totalFailures: 0,
  };
}

function proxyRequest(
  backend: BackendState,
  clientReq: IncomingMessage,
  clientRes: ServerResponse,
  requestTimeoutMs: number
): Promise<void> {
  return new Promise((resolve) => {
    const target = new URL(backend.config.url);
    const isHttps = target.protocol === "https:";
    const requestFn = isHttps ? httpsRequest : httpRequest;

    const proxyReq = requestFn(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: clientReq.url,
        method: clientReq.method,
        headers: { ...clientReq.headers, host: target.host },
        timeout: requestTimeoutMs,
      },
      (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(clientRes);
        proxyRes.on("end", resolve);
      }
    );

    proxyReq.on("timeout", () => proxyReq.destroy(new Error("Upstream request timed out")));

    proxyReq.on("error", (err) => {
      backend.totalFailures += 1;
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { "content-type": "application/json" });
        clientRes.end(JSON.stringify({ error: "Bad gateway", detail: err.message }));
      } else {
        clientRes.end();
      }
      resolve();
    });

    clientReq.pipe(proxyReq);
  });
}

/**
 * Starts an HTTP reverse-proxy load balancer that distributes incoming
 * requests across the configured backends using the chosen strategy,
 * skipping any backend currently marked unhealthy.
 */
export function createLoadBalancer(config: LoadBalancerConfig): LoadBalancerHandle {
  if (!config.backends || config.backends.length === 0) {
    throw new Error("At least one backend must be configured");
  }

  const strategy = config.strategy ?? "round-robin";
  const healthCheckIntervalMs = config.healthCheckIntervalMs ?? 10_000;
  const healthCheckTimeoutMs = config.healthCheckTimeoutMs ?? 2_000;
  const requestTimeoutMs = config.requestTimeoutMs ?? 10_000;

  const backends = config.backends.map(toBackendState);
  const roundRobinCursor = { index: 0 };

  const stopHealthChecks = startHealthChecks(
    backends,
    healthCheckIntervalMs,
    healthCheckTimeoutMs
  );

  const server = http.createServer((req, res) => {
    const backend = pickBackend(backends, strategy, roundRobinCursor);

    if (!backend) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "No healthy backends available" }));
      return;
    }

    backend.activeConnections += 1;
    backend.totalRequests += 1;

    void proxyRequest(backend, req, res, requestTimeoutMs).finally(() => {
      backend.activeConnections -= 1;
    });
  });

  server.listen(config.port);

  const close = () =>
    new Promise<void>((resolve, reject) => {
      stopHealthChecks();
      server.close((err) => (err ? reject(err) : resolve()));
    });

  return { server, backends, close };
}
