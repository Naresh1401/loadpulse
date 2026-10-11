# loadpulse

A lightweight, dependency-free (runtime) **reverse-proxy load balancer** and
**CLI performance/load testing tool** for your deployed services, written in
TypeScript.

It ships two command-line tools:

- **`loadpulse-lb`** — distributes incoming HTTP traffic across multiple
  backend instances, with health checks and pluggable balancing strategies.
- **`loadpulse-bench`** — fires concurrent requests at a deployed URL and
  reports throughput and latency statistics (p50/p90/p95/p99).

## Installation

```bash
git clone https://github.com/Naresh1401/loadpulse.git
cd loadpulse
npm install
npm run build
```

Or run directly from source during development with `tsx` (no build step):

```bash
npm run dev:lb -- --backend http://localhost:4001 --backend http://localhost:4002
npm run dev:bench -- --url https://my-app.example.com --requests 200 --concurrency 20
```

## Load balancer (`loadpulse-lb`)

Routes incoming requests to one of several backend servers, skipping any
backend that fails its health check.

```bash
# Using CLI flags
npx loadpulse-lb --port 8080 \
  --backend http://localhost:4001 \
  --backend http://localhost:4002 \
  --backend http://localhost:4003 \
  --strategy round-robin

# Using a config file
npx loadpulse-lb --config config/loadbalancer.example.json
```

### Config file shape

```json
{
  "port": 8080,
  "strategy": "round-robin",
  "healthCheckIntervalMs": 10000,
  "healthCheckTimeoutMs": 2000,
  "requestTimeoutMs": 10000,
  "backends": [
    { "url": "http://localhost:4001", "healthPath": "/health" },
    { "url": "http://localhost:4002", "healthPath": "/health" }
  ]
}
```

### Balancing strategies

| Strategy            | Behavior                                              |
| -------------------- | ------------------------------------------------------ |
| `round-robin`         | Cycles through healthy backends in order (default).    |
| `random`              | Picks a healthy backend at random.                      |
| `least-connections`   | Picks the healthy backend with the fewest active requests. |

Unhealthy backends (failing their periodic health check) are automatically
removed from rotation and re-added once they recover. If every backend is
unhealthy, the load balancer responds with `503 Service Unavailable`.

### Programmatic usage

```ts
import { createLoadBalancer } from "loadpulse";

const lb = createLoadBalancer({
  port: 8080,
  strategy: "least-connections",
  backends: [{ url: "http://localhost:4001" }, { url: "http://localhost:4002" }],
});

// later
await lb.close();
```

## Performance / load testing (`loadpulse-bench`)

Load-test any deployed HTTP(S) endpoint and get latency/throughput stats.

```bash
# Send a fixed number of requests
npx loadpulse-bench --url https://my-app.example.com/health \
  --requests 500 --concurrency 20

# Or run for a fixed duration
npx loadpulse-bench --url https://my-app.example.com/api \
  --duration 30000 --concurrency 50 \
  --header "Authorization: Bearer <token>" \
  --method POST --body '{"ping":true}'

# Machine-readable output
npx loadpulse-bench --url https://my-app.example.com --requests 100 --json
```

Example output:

```
loadpulse-bench results for https://my-app.example.com/health
--------------------------------------------------
Total requests:     500
Successful:         498
Failed:             2
Duration:           4123 ms
Requests/sec:       121.27
Latency (ms):
  min:  12.4
  mean: 81.6
  p50:  74.2
  p90:  142.8
  p95:  180.1
  p99:  310.5
  max:  412.9
Status codes:
  200: 498
  error: 2
```

### Programmatic usage

```ts
import { runBenchmark } from "loadpulse/bench";

const result = await runBenchmark({
  url: "https://my-app.example.com/health",
  requests: 200,
  concurrency: 20,
});
console.log(result.requestsPerSecond, result.latency.p95Ms);
```

## Development

```bash
npm install      # install dependencies
npm run build    # compile TypeScript to dist/
npm test         # run the test suite (vitest)
```

## License

[MIT](./LICENSE)
