#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createLoadBalancer } from "../load-balancer/index.js";
import { parseArgs } from "../common/args.js";
import type { BalancingStrategy, LoadBalancerConfig } from "../load-balancer/types.js";

const HELP = `
loadpulse-lb - a simple reverse-proxy load balancer for your deployed services

Usage:
  loadpulse-lb --config path/to/config.json
  loadpulse-lb --port 8080 --backend http://localhost:4001 --backend http://localhost:4002

Options:
  --config <file>       Load options from a JSON config file (see config/loadbalancer.example.json)
  --port <number>        Port to listen on (default: 8080)
  --backend <url>        Backend URL. Repeat for multiple backends.
  --strategy <name>      round-robin | random | least-connections (default: round-robin)
  --health-path <path>   Path used for health checks (default: "/")
  --health-interval <ms> Health check interval in ms (default: 10000, 0 disables)
  --help                 Show this help message
`;

function loadConfig(): LoadBalancerConfig {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (typeof args.config === "string") {
    const raw = readFileSync(args.config, "utf-8");
    return JSON.parse(raw) as LoadBalancerConfig;
  }

  const backendArg = args.backend;
  const backendUrls = Array.isArray(backendArg)
    ? backendArg
    : typeof backendArg === "string"
      ? [backendArg]
      : [];

  if (backendUrls.length === 0) {
    console.error("Error: provide at least one --backend <url> or a --config file.\n");
    console.log(HELP);
    process.exit(1);
  }

  return {
    port: Number(args.port ?? 8080),
    backends: backendUrls.map((url) => ({
      url,
      healthPath: typeof args["health-path"] === "string" ? args["health-path"] : "/",
    })),
    strategy: (typeof args.strategy === "string" ? args.strategy : "round-robin") as BalancingStrategy,
    healthCheckIntervalMs:
      args["health-interval"] !== undefined ? Number(args["health-interval"]) : undefined,
  };
}

function main(): void {
  const config = loadConfig();
  const { server, close } = createLoadBalancer(config);

  server.on("listening", () => {
    console.log(`loadpulse-lb listening on port ${config.port}`);
    console.log(`Strategy: ${config.strategy ?? "round-robin"}`);
    console.log(`Backends: ${config.backends.map((b) => b.url).join(", ")}`);
  });

  const shutdown = () => {
    console.log("\nShutting down loadpulse-lb...");
    void close().then(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
