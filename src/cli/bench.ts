#!/usr/bin/env node
import { runBenchmark } from "../bench/index.js";
import { parseArgs } from "../common/args.js";
import type { BenchOptions } from "../bench/types.js";

const HELP = `
loadpulse-bench - a CLI performance/load testing tool for deployed endpoints

Usage:
  loadpulse-bench --url https://my-deployed-app.example.com/health --requests 500 --concurrency 20
  loadpulse-bench --url https://my-deployed-app.example.com/api --duration 30000 --concurrency 50

Options:
  --url <url>            Target URL to load test (required)
  --method <method>      HTTP method (default: GET)
  --header <k:v>         Extra header, e.g. "Authorization: Bearer xyz". Repeatable.
  --body <string>        Request body to send with each request
  --concurrency <n>      Number of concurrent workers (default: 10)
  --requests <n>         Total number of requests to send
  --duration <ms>        How long to keep sending requests, in ms
  --timeout <ms>         Per-request timeout in ms (default: 10000)
  --json                 Print raw JSON results instead of a formatted summary
  --help                 Show this help message
`;

function parseHeaders(raw: string | string[] | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const entries = Array.isArray(raw) ? raw : [raw];
  const headers: Record<string, string> = {};
  for (const entry of entries) {
    const sepIndex = entry.indexOf(":");
    if (sepIndex === -1) continue;
    const key = entry.slice(0, sepIndex).trim();
    const value = entry.slice(sepIndex + 1).trim();
    headers[key] = value;
  }
  return headers;
}

function buildOptions(): { options: BenchOptions; json: boolean } {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (!args.url) {
    console.error("Error: --url <url> is required.\n");
    console.log(HELP);
    process.exit(1);
  }

  if (!args.requests && !args.duration) {
    console.error("Error: specify --requests <n> or --duration <ms>.\n");
    console.log(HELP);
    process.exit(1);
  }

  const options: BenchOptions = {
    url: String(args.url),
    method: typeof args.method === "string" ? args.method : undefined,
    headers: parseHeaders(args.header as string | string[] | undefined),
    body: typeof args.body === "string" ? args.body : undefined,
    concurrency: args.concurrency ? Number(args.concurrency) : undefined,
    requests: args.requests ? Number(args.requests) : undefined,
    durationMs: args.duration ? Number(args.duration) : undefined,
    timeoutMs: args.timeout ? Number(args.timeout) : undefined,
  };

  return { options, json: Boolean(args.json) };
}

function printSummary(result: Awaited<ReturnType<typeof runBenchmark>>): void {
  console.log(`\nloadpulse-bench results for ${result.url}`);
  console.log("-".repeat(50));
  console.log(`Total requests:     ${result.totalRequests}`);
  console.log(`Successful:         ${result.successCount}`);
  console.log(`Failed:             ${result.failureCount}`);
  console.log(`Duration:           ${result.durationMs.toFixed(0)} ms`);
  console.log(`Requests/sec:       ${result.requestsPerSecond.toFixed(2)}`);
  console.log("Latency (ms):");
  console.log(`  min:  ${result.latency.minMs.toFixed(1)}`);
  console.log(`  mean: ${result.latency.meanMs.toFixed(1)}`);
  console.log(`  p50:  ${result.latency.p50Ms.toFixed(1)}`);
  console.log(`  p90:  ${result.latency.p90Ms.toFixed(1)}`);
  console.log(`  p95:  ${result.latency.p95Ms.toFixed(1)}`);
  console.log(`  p99:  ${result.latency.p99Ms.toFixed(1)}`);
  console.log(`  max:  ${result.latency.maxMs.toFixed(1)}`);
  console.log("Status codes:");
  for (const [code, count] of Object.entries(result.statusCodeCounts)) {
    console.log(`  ${code}: ${count}`);
  }
}

async function main(): Promise<void> {
  const { options, json } = buildOptions();
  const result = await runBenchmark(options);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printSummary(result);
  }
}

main().catch((err) => {
  console.error("loadpulse-bench failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
