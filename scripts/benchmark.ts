import autocannon, { Options, Result } from 'autocannon';
import { SystemRole } from '../src/app/user/types';
import { generateAccessToken } from '../src/lib/utils/common';

interface BenchmarkTarget {
  domain: string;
  name: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: string;
  headers?: Record<string, string>;
}

interface BenchmarkSummary {
  domain: string;
  name: string;
  method: string;
  path: string;
  requestsPerSec: number;
  totalRequests: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successRate: number;
  status2xx: number;
  errorCount: number;
}

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const CONNECTIONS = Number(process.env.BENCHMARK_CONNECTIONS || 100);
const DURATION = Number(process.env.BENCHMARK_DURATION || 5);
const WARMUP_DURATION = 2; // Seconds
const COOLDOWN_MS = 1000; // 1 second between tests to let GC & DB connections settle

// ANSI Colors for Terminal Styling
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
};

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function checkServerAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

function createAuthHeaders(payload: {
  userId: number;
  email: string;
  role: string;
  restaurantId?: number;
  restaurantRole?: string;
  branchIds?: number[];
}): Record<string, string> {
  const token = generateAccessToken(payload);
  return {
    Authorization: `Bearer ${token}`,
    Cookie: `access_token=${token}`,
  };
}

function runAutocannon(opts: Options): Promise<Result> {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// Helper to pad strings accurately even when they contain ANSI color codes
function padAnsi(str: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const cleanStr = str.replace(/\x1b\[[0-9;]*m/g, '');
  const padLen = Math.max(0, width - cleanStr.length);
  if (align === 'right') return ' '.repeat(padLen) + str;
  if (align === 'center') {
    const left = Math.floor(padLen / 2);
    const right = padLen - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
  }
  return str + ' '.repeat(padLen);
}

function colorizeLatency(ms: number, width: number): string {
  const str = `${ms.toFixed(1)}ms`;
  const padded = padAnsi(str, width, 'right');
  if (ms < 40) return `${c.green}${padded}${c.reset}`;
  if (ms < 120) return `${c.yellow}${padded}${c.reset}`;
  return `${c.red}${padded}${c.reset}`;
}

function colorizeRps(rps: number, width: number): string {
  const str = `${rps.toLocaleString()} req/s`;
  const padded = padAnsi(str, width, 'right');
  if (rps >= 3000) return `${c.bold}${c.green}${padded}${c.reset}`;
  if (rps >= 1000) return `${c.bold}${c.cyan}${padded}${c.reset}`;
  return `${c.bold}${c.yellow}${padded}${c.reset}`;
}

function colorizeSuccess(rate: number, width: number): string {
  const str = `${rate.toFixed(1)}%`;
  const padded = padAnsi(str, width, 'right');
  if (rate === 100) return `${c.green}${padded}${c.reset}`;
  if (rate >= 95) return `${c.yellow}${padded}${c.reset}`;
  return `${c.bold}${c.red}${padded}${c.reset}`;
}

function printReport(results: BenchmarkSummary[]) {
  const cols = {
    domain: 12,
    method: 6,
    path: 44,
    rps: 14,
    avg: 11,
    p50: 11,
    p95: 11,
    p99: 11,
    success: 10,
  };

  const drawLine = (left: string, mid: string, right: string, fill: string) =>
    left +
    Object.values(cols)
      .map((w) => fill.repeat(w + 2))
      .join(mid) +
    right;

  console.log('\n' + drawLine('╔', '╦', '╗', '═'));
  const title = '🚀  API BENCHMARK PERFORMANCE REPORT';
  const totalWidth = Object.values(cols).reduce((a, b) => a + b + 3, -1);
  console.log(`║${padAnsi(`${c.bold}${c.cyan}${title}${c.reset}`, totalWidth, 'center')}║`);
  const subtitle = `Target: ${BASE_URL}  •  Concurrency: ${CONNECTIONS}  •  Duration: ${DURATION}s  •  Cooldown: ${COOLDOWN_MS}ms`;
  console.log(`║${padAnsi(`${c.dim}${subtitle}${c.reset}`, totalWidth, 'center')}║`);
  console.log(drawLine('╠', '╬', '╣', '═'));

  // Header Row
  console.log(
    '║ ' +
      [
        padAnsi(`${c.bold}Domain${c.reset}`, cols.domain, 'left'),
        padAnsi(`${c.bold}Method${c.reset}`, cols.method, 'center'),
        padAnsi(`${c.bold}Endpoint${c.reset}`, cols.path, 'left'),
        padAnsi(`${c.bold}Throughput${c.reset}`, cols.rps, 'right'),
        padAnsi(`${c.bold}Avg Lat${c.reset}`, cols.avg, 'right'),
        padAnsi(`${c.bold}p50 Lat${c.reset}`, cols.p50, 'right'),
        padAnsi(`${c.bold}p95 Lat${c.reset}`, cols.p95, 'right'),
        padAnsi(`${c.bold}p99 Lat${c.reset}`, cols.p99, 'right'),
        padAnsi(`${c.bold}2xx Rate${c.reset}`, cols.success, 'right'),
      ].join(' │ ') +
      ' ║',
  );

  console.log(drawLine('╠', '╪', '╣', '═'));

  // Data Rows
  let lastDomain = '';
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (i > 0 && r.domain !== lastDomain) {
      console.log(drawLine('╟', '┼', '╢', '─'));
    }
    lastDomain = r.domain;

    const domainStr = padAnsi(`${c.magenta}${r.domain}${c.reset}`, cols.domain, 'left');
    const methodStr = padAnsi(`${c.bold}${c.blue}${r.method}${c.reset}`, cols.method, 'center');
    const cleanPath = r.path.length > cols.path ? r.path.slice(0, cols.path - 1) + '…' : r.path;
    const pathStr = padAnsi(cleanPath, cols.path, 'left');

    console.log(
      '║ ' +
        [
          domainStr,
          methodStr,
          pathStr,
          colorizeRps(r.requestsPerSec, cols.rps),
          colorizeLatency(r.avgLatencyMs, cols.avg),
          colorizeLatency(r.p50LatencyMs, cols.p50),
          colorizeLatency(r.p95LatencyMs, cols.p95),
          colorizeLatency(r.p99LatencyMs, cols.p99),
          colorizeSuccess(r.successRate, cols.success),
        ].join(' │ ') +
        ' ║',
    );
  }

  console.log(drawLine('╚', '╩', '╝', '═'));

  // Summary Highlights
  const maxRps = Math.max(...results.map((r) => r.requestsPerSec), 0);
  const minRps = Math.min(...results.map((r) => r.requestsPerSec), 0);
  const fastestEndpoint = results.find((r) => r.requestsPerSec === maxRps);
  const slowestEndpoint = results.find((r) => r.requestsPerSec === minRps);

  const avgLatency = (results.reduce((acc, r) => acc + r.avgLatencyMs, 0) / (results.length || 1)).toFixed(1);
  const avgP95 = (results.reduce((acc, r) => acc + r.p95LatencyMs, 0) / (results.length || 1)).toFixed(1);
  const totalRequests = results.reduce((acc, r) => acc + r.totalRequests, 0);
  const total2xx = results.reduce((acc, r) => acc + r.status2xx, 0);
  const totalErrors = results.reduce((acc, r) => acc + r.errorCount, 0);
  const overallSuccessRate = totalRequests > 0 ? ((total2xx / totalRequests) * 100).toFixed(2) + '%' : '0.00%';

  console.log(`\n${c.bold}${c.cyan}📊 BENCHMARK SUMMARY HIGHLIGHTS:${c.reset}`);
  console.log(`  ├─ ${c.bold}Endpoints Tested :${c.reset} ${results.length} endpoints`);
  console.log(
    `  ├─ ${c.bold}Peak Throughput  :${c.reset} ${c.green}${maxRps.toLocaleString()} req/s${c.reset} (${fastestEndpoint?.path || 'N/A'})`,
  );
  console.log(
    `  ├─ ${c.bold}Bottleneck       :${c.reset} ${c.yellow}${minRps.toLocaleString()} req/s${c.reset} (${slowestEndpoint?.path || 'N/A'})`,
  );
  console.log(`  ├─ ${c.bold}Overall Latency  :${c.reset} ${avgLatency}ms avg  |  ${avgP95}ms p95`);
  console.log(
    `  └─ ${c.bold}True 2xx Success :${c.reset} ${overallSuccessRate} (${total2xx.toLocaleString()} / ${totalRequests.toLocaleString()} requests, ${totalErrors} failed/non-2xx)\n`,
  );
}

async function main() {
  console.log(`\n${c.bold}${c.cyan}🚀 Initializing Accurate API Benchmarks...${c.reset}`);
  console.log(`  • Target URL  : ${BASE_URL}`);
  console.log(`  • Concurrency : ${CONNECTIONS} connections (Pipelining: 1 - Realistic User Flow)`);
  console.log(`  • Duration    : ${DURATION}s per endpoint (+${WARMUP_DURATION}s JIT/Pool Warm-up)\n`);

  const isAlive = await checkServerAlive();
  if (!isAlive) {
    console.error(`${c.red}❌ Server is NOT reachable at ${BASE_URL}${c.reset}`);
    console.error(`👉 Please start your server in another terminal first:\n   npm run start\n`);
    process.exit(1);
  }

  // Warm-up Phase: Critical for V8 JIT compilation & DB Connection Pool initialization
  process.stdout.write(`${c.yellow}🔥 Warming up server, JIT compiler, and connection pools (${WARMUP_DURATION}s)... ${c.reset}`);
  await runAutocannon({
    url: `${BASE_URL}/api/health`,
    method: 'GET',
    connections: CONNECTIONS,
    duration: WARMUP_DURATION,
  });
  await sleep(COOLDOWN_MS);
  console.log(`${c.green}Done!${c.reset}\n`);

  const adminHeaders = createAuthHeaders({
    userId: 1,
    email: 'admin@quickbite.com',
    role: SystemRole.SYSTEM_ADMIN,
  });

  const ownerHeaders = createAuthHeaders({
    userId: 2,
    email: 'owner@quickbite.com',
    role: SystemRole.RESTAURANT_USER,
    restaurantId: 1,
    restaurantRole: 'owner',
    branchIds: [1],
  });

  const customerHeaders = createAuthHeaders({
    userId: 3,
    email: 'customer@quickbite.com',
    role: SystemRole.CUSTOMER,
  });

  const agentHeaders = createAuthHeaders({
    userId: 4,
    email: 'agent@quickbite.com',
    role: SystemRole.DELIVERY_AGENT,
  });

  const targets: BenchmarkTarget[] = [
    { domain: 'Health', name: 'Service & Database Liveness', method: 'GET', path: '/api/health' },
    { domain: 'Branch', name: 'PostGIS Nearby Search', method: 'GET', path: '/api/branches/nearby?lng=31.2357&lat=30.0444' },
    { domain: 'Branch', name: 'Single Branch Details', method: 'GET', path: '/api/branches/1' },
    { domain: 'Branch', name: 'Restaurant Branches (Cached)', method: 'GET', path: '/api/restaurants/1/branches' },
    { domain: 'Product', name: 'Branch Menu & Price (Cached)', method: 'GET', path: '/api/branches/1/products' },
    { domain: 'Product', name: 'Single Product Details', method: 'GET', path: '/api/products/1' },
    { domain: 'Product', name: 'Restaurant Product Categories', method: 'GET', path: '/api/restaurants/1/categories' },
    {
      domain: 'Product',
      name: 'Restaurant Product Catalog',
      method: 'GET',
      path: '/api/restaurants/1/products',
      headers: adminHeaders,
    },
    { domain: 'Restaurant', name: 'Restaurant Cursor Pagination', method: 'GET', path: '/api/restaurant', headers: adminHeaders },
    { domain: 'Restaurant', name: 'Single Restaurant Details', method: 'GET', path: '/api/restaurant/1', headers: adminHeaders },
    { domain: 'User', name: 'User Profile Details', method: 'GET', path: '/api/user/1', headers: customerHeaders },
    { domain: 'Address', name: 'Customer Saved Addresses', method: 'GET', path: '/api/address', headers: customerHeaders },
    {
      domain: 'RBAC',
      name: 'Restaurant Staff Members List',
      method: 'GET',
      path: '/api/restaurants/1/members',
      headers: ownerHeaders,
    },
    {
      domain: 'RBAC',
      name: 'Role Assigned Permissions',
      method: 'GET',
      path: '/api/roles/owner/permissions',
      headers: ownerHeaders,
    },
    { domain: 'Order', name: 'Customer Order History', method: 'GET', path: '/api/orders/customer', headers: customerHeaders },
    { domain: 'Order', name: 'Branch Kitchen Order Queue', method: 'GET', path: '/api/branches/1/orders', headers: adminHeaders },
    {
      domain: 'Finance',
      name: 'Restaurant Real-Time Balance',
      method: 'GET',
      path: '/api/restaurants/1/balance',
      headers: ownerHeaders,
    },
    {
      domain: 'Finance',
      name: 'Restaurant Payout History',
      method: 'GET',
      path: '/api/restaurants/1/payouts',
      headers: ownerHeaders,
    },
    {
      domain: 'Payment',
      name: 'Restaurant Payment History',
      method: 'GET',
      path: '/api/restaurants/1/payments',
      headers: adminHeaders,
    },
    { domain: 'Agent', name: 'Agent Active Delivery Tasks', method: 'GET', path: '/api/agents/tasks', headers: agentHeaders },
    {
      domain: 'Agent',
      name: 'Agent Shift Earnings Breakdown',
      method: 'GET',
      path: '/api/agents/earnings',
      headers: agentHeaders,
    },
    {
      domain: 'Agent',
      name: 'Agent Shift Earnings Summary',
      method: 'GET',
      path: '/api/agents/earnings/sum',
      headers: agentHeaders,
    },
  ];

  const summaries: BenchmarkSummary[] = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const fullUrl = `${BASE_URL}${t.path}`;
    const progress = `[${String(i + 1).padStart(2, '0')}/${targets.length}]`;
    process.stdout.write(`${c.dim}${progress}${c.reset} Testing ${t.domain.padEnd(10)} ${c.cyan}${t.path.padEnd(43)}${c.reset} `);

    try {
      const result = await runAutocannon({
        url: fullUrl,
        method: t.method || 'GET',
        connections: CONNECTIONS,
        pipelining: 1, // Explicitly set to 1 to prevent unrealistic pipelining inflation
        duration: DURATION,
        headers: t.headers,
        body: t.body,
      });

      const status2xx = (result as any)['2xx'] || 0;
      const errorCount = result.errors + result.timeouts + result.non2xx;
      const totalReqs = result.requests.total;
      const successRate = totalReqs > 0 ? (status2xx / totalReqs) * 100 : 0;

      // Interpolate p95 more realistically between p90 and p97_5 if p95 is missing in autocannon types
      const p90 = result.latency.p90 || result.latency.average;
      const p97_5 = result.latency.p97_5 || p90;
      const estimatedP95 = p90 + (p97_5 - p90) * (5 / 7.5);

      summaries.push({
        domain: t.domain,
        name: t.name,
        method: t.method || 'GET',
        path: t.path,
        requestsPerSec: Math.round(result.requests.average),
        totalRequests: totalReqs,
        avgLatencyMs: Math.round(result.latency.average * 10) / 10,
        p50LatencyMs: Math.round((result.latency.p50 || 0) * 10) / 10,
        p95LatencyMs: Math.round(estimatedP95 * 10) / 10,
        p99LatencyMs: Math.round((result.latency.p99 || 0) * 10) / 10,
        successRate,
        status2xx,
        errorCount,
      });

      const warningFlag = status2xx === 0 ? `${c.red}⚠️ 0% 2xx (Check Auth/Seed Data!)${c.reset}` : `${c.green}✅${c.reset}`;
      console.log(
        `${warningFlag} ${String(Math.round(result.requests.average).toLocaleString()).padStart(6)} req/s (${result.latency.average.toFixed(1)}ms)`,
      );

      // Cooldown between endpoints to allow Garbage Collection and TCP sockets to clear
      if (i < targets.length - 1) {
        await sleep(COOLDOWN_MS);
      }
    } catch (err: any) {
      console.log(`${c.red}❌ Failed: ${err.message}${c.reset}`);
    }
  }

  printReport(summaries);
}

main().catch((err) => {
  console.error('Fatal error during benchmark:', err);
  process.exit(1);
});
