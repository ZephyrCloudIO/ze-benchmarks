# D1 Sync Issue - Diagnosis and Fix

**Date**: 2025-11-17
**Issue**: D1 database not updating despite `ZE_BENCHMARKS_WORKER_URL` being set
**Status**: 🔍 **ROOT CAUSE IDENTIFIED**

---

## Problem Summary

User reports that D1 isn't updating even though:
- ✅ `ZE_BENCHMARKS_WORKER_URL=https://bench-api-dev.zephyr-cloud.io` is set in `.env`
- ✅ `ZE_BENCHMARKS_AUTO_SYNC=true` is set in `.env`

---

## Root Cause

**File**: `packages/worker-client/src/client.ts:13`

```typescript
// INCORRECT - doesn't specify path to .env
config();
```

This is calling `dotenv.config()` **without specifying the path** to the `.env` file.

**Problem**: When `dotenv.config()` is called without arguments, it looks for `.env` in the **current working directory** (`process.cwd()`), not the project root. This means:
- ✅ Works when running from project root: `cd /path/to/ze-benchmarks && pnpm bench`
- ❌ Fails when running from subdirectory or via external invocation
- ❌ Environment variable never loaded → `ZE_BENCHMARKS_WORKER_URL` is undefined
- ❌ WorkerClient falls back to default: `http://localhost:8787`
- ❌ Data goes to local development, not production D1!

---

## Comparison with Other Files

### ✅ Correct Pattern (used elsewhere):

**`packages/database/src/worker-logger.ts:7`**:
```typescript
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env') });
```

**`packages/database/src/logger.ts:10`**:
```typescript
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env') });
```

**`packages/evaluators/src/evaluators/llm-judge.ts:7`**:
```typescript
import { resolve } from 'node:path';
dotenv.config({ path: resolve(process.cwd(), '.env') });
```

### ❌ Incorrect Pattern:

**`packages/worker-client/src/client.ts:13`**:
```typescript
// Missing path specification!
config();
```

---

## Current Behavior Flow

1. User runs: `pnpm bench shadcn-generate-vite basic L0 anthropic`
2. Harness starts → imports `BenchmarkLogger` from `@ze/worker-client`
3. BenchmarkLogger creates WorkerClient
4. WorkerClient calls `config()` on line 13
5. **dotenv looks for .env in current directory (might not find it!)**
6. `process.env.ZE_BENCHMARKS_WORKER_URL` is `undefined`
7. WorkerClient falls back to default: `http://localhost:8787` (line 27)
8. All data gets sent to localhost instead of `https://bench-api-dev.zephyr-cloud.io`
9. D1 production database never receives updates ❌

---

## The Fix

### Option 1: Match Existing Pattern (Recommended)

```typescript
// packages/worker-client/src/client.ts
import { config } from 'dotenv';
import { resolve } from 'node:path';  // ADD THIS
import type {
  SubmitRunPayload,
  SubmitBatchPayload,
  BenchmarkRun,
  BatchRun,
  RunStatistics,
  DetailedRunStatistics,
  BatchStatistics,
} from './types';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });  // FIX THIS LINE
```

### Option 2: Use Project Root Detection

```typescript
// packages/worker-client/src/client.ts
import { config } from 'dotenv';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';

// Find project root
function findProjectRoot(): string {
  let currentDir = process.cwd();
  while (currentDir !== resolve(currentDir, '..')) {
    if (existsSync(join(currentDir, 'benchmark.config.json'))) {
      return currentDir;
    }
    if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    currentDir = resolve(currentDir, '..');
  }
  return process.cwd();
}

// Load environment variables from project root
const projectRoot = findProjectRoot();
config({ path: join(projectRoot, '.env') });
```

---

## Verification Steps

### 1. Check if WorkerClient is loading environment

**Add debug logging**:
```typescript
// packages/worker-client/src/client.ts
constructor(config?: Partial<WorkerClientConfig>) {
  // ADD DEBUG LOGGING
  console.log('[WorkerClient] Environment check:');
  console.log(`  ZE_BENCHMARKS_WORKER_URL = ${process.env.ZE_BENCHMARKS_WORKER_URL || '(not set)'}`);
  console.log(`  ZE_BENCHMARKS_API_KEY = ${process.env.ZE_BENCHMARKS_API_KEY ? '***set***' : '(not set)'}`);

  this.workerUrl = config?.workerUrl || process.env.ZE_BENCHMARKS_WORKER_URL || 'http://localhost:8787';
  this.apiKey = config?.apiKey || process.env.ZE_BENCHMARKS_API_KEY || 'dev-local-key';
  this.timeout = config?.timeout || 30000;

  // ADD FINAL URL LOGGING
  console.log(`[WorkerClient] Initialized with URL: ${this.workerUrl}`);

  // Ensure workerUrl doesn't end with slash
  this.workerUrl = this.workerUrl.replace(/\/$/, '');
}
```

### 2. Run benchmark and check output

```bash
pnpm bench test-suite simple-test L1 echo
```

**Expected output (BEFORE fix)**:
```
[WorkerClient] Environment check:
  ZE_BENCHMARKS_WORKER_URL = (not set)
  ZE_BENCHMARKS_API_KEY = (not set)
[WorkerClient] Initialized with URL: http://localhost:8787
```

**Expected output (AFTER fix)**:
```
[WorkerClient] Environment check:
  ZE_BENCHMARKS_WORKER_URL = https://bench-api-dev.zephyr-cloud.io
  ZE_BENCHMARKS_API_KEY = ***set***
[WorkerClient] Initialized with URL: https://bench-api-dev.zephyr-cloud.io
```

### 3. Test worker connection

```bash
# Test health endpoint
curl https://bench-api-dev.zephyr-cloud.io/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-17T..."
}
```

### 4. Verify D1 receives data

After running a benchmark, check if data arrived:

```bash
# Query dev D1 database
pnpm wrangler d1 execute ze-benchmarks-dev \
  --command "SELECT run_id, suite, scenario, agent, started_at FROM benchmark_runs ORDER BY started_at DESC LIMIT 5" \
  --env dev
```

---

## Related Issues

### Issue 1: Multiple Logger Implementations

There are **two** worker logger implementations:
1. `packages/database/src/worker-logger.ts` - Direct HTTP, has correct `config()` call
2. `packages/worker-client/src/logger.ts` - Uses WorkerClient wrapper, inherits broken `config()`

The harness uses `@ze/worker-client` (implementation #2), which depends on the broken `WorkerClient`.

### Issue 2: Auto-Sync Flag Not Used

The `ZE_BENCHMARKS_AUTO_SYNC` environment variable is set but **never checked** in the code:

```bash
# From .env
ZE_BENCHMARKS_AUTO_SYNC=true
```

**No code reads this variable!**

Possible intended behavior:
- If `true`: Use worker-based logger (current behavior)
- If `false`: Use local SQLite logger

Consider implementing this flag:
```typescript
// packages/worker-client/src/logger.ts
const autoSync = process.env.ZE_BENCHMARKS_AUTO_SYNC === 'true';
if (!autoSync) {
  console.warn('[BenchmarkLogger] ZE_BENCHMARKS_AUTO_SYNC is disabled. Using local-only mode.');
  // Fall back to local logger or throw error
}
```

---

## Implementation Plan

### Step 1: Fix WorkerClient dotenv loading ⚠️ CRITICAL

```typescript
// packages/worker-client/src/client.ts
import { config } from 'dotenv';
import { resolve } from 'node:path';
// ... rest of imports

// CHANGE THIS LINE:
// config();
// TO THIS:
config({ path: resolve(process.cwd(), '.env') });
```

### Step 2: Add debug logging (temporary)

```typescript
constructor(config?: Partial<WorkerClientConfig>) {
  console.log('[WorkerClient] Env vars:', {
    workerUrl: process.env.ZE_BENCHMARKS_WORKER_URL,
    apiKeySet: !!process.env.ZE_BENCHMARKS_API_KEY
  });

  this.workerUrl = config?.workerUrl || process.env.ZE_BENCHMARKS_WORKER_URL || 'http://localhost:8787';
  this.apiKey = config?.apiKey || process.env.ZE_BENCHMARKS_API_KEY || 'dev-local-key';
  this.timeout = config?.timeout || 30000;

  console.log(`[WorkerClient] Initialized: ${this.workerUrl}`);
  this.workerUrl = this.workerUrl.replace(/\/$/, '');
}
```

### Step 3: Test fix

```bash
# Run a test benchmark
pnpm bench test-suite simple-test L1 echo

# Should see:
# [WorkerClient] Env vars: { workerUrl: 'https://bench-api-dev.zephyr-cloud.io', apiKeySet: true }
# [WorkerClient] Initialized: https://bench-api-dev.zephyr-cloud.io
# [BenchmarkLogger] Run completed: <runId>
```

### Step 4: Verify D1 data

```bash
# Check dev database
pnpm wrangler d1 execute ze-benchmarks-dev \
  --command "SELECT COUNT(*) as total_runs FROM benchmark_runs" \
  --env dev
```

Should show incremented count after benchmark runs.

### Step 5: Remove debug logging

Once confirmed working, remove temporary debug logs.

---

## Additional Recommendations

### 1. Consolidate Logger Implementations

Currently there are:
- `packages/database/src/logger.ts` - Local SQLite
- `packages/database/src/worker-logger.ts` - Worker HTTP (unused)
- `packages/worker-client/src/logger.ts` - Worker HTTP via client (used)

**Recommendation**: Remove unused `worker-logger.ts` to avoid confusion.

### 2. Implement Auto-Sync Flag

```typescript
// packages/worker-client/src/client.ts or logger.ts
export function getWorkerClient(config?: Partial<WorkerClientConfig>): WorkerClient {
  const autoSync = process.env.ZE_BENCHMARKS_AUTO_SYNC !== 'false';

  if (!autoSync) {
    throw new Error('ZE_BENCHMARKS_AUTO_SYNC is disabled. Cannot create WorkerClient.');
  }

  if (!clientInstance || config) {
    clientInstance = new WorkerClient(config);
  }
  return clientInstance;
}
```

### 3. Add Connection Test on Startup

```typescript
// packages/worker-client/src/logger.ts
private constructor() {
  this.client = getWorkerClient();

  // Test connection on startup
  this.client.healthCheck().then(healthy => {
    if (healthy) {
      console.log('✅ Worker connection verified');
    } else {
      console.warn('⚠️  Worker health check failed. Results may not sync.');
    }
  }).catch(err => {
    console.error('❌ Worker connection error:', err.message);
  });
}
```

### 4. Better Error Messages

```typescript
async submitRun(payload: SubmitRunPayload): Promise<{ runId: string }> {
  try {
    const response = await this.fetch('/api/results', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return await response.json() as { runId: string };
  } catch (error: any) {
    console.error('[WorkerClient] Failed to submit run:', error.message);
    console.error('  Worker URL:', this.workerUrl);
    console.error('  Payload:', JSON.stringify(payload, null, 2));
    throw error;
  }
}
```

---

## Testing Checklist

After applying the fix:

- [ ] Run benchmark from project root
- [ ] Run benchmark from subdirectory
- [ ] Verify WorkerClient logs show correct URL
- [ ] Verify health check passes
- [ ] Verify run data appears in D1
- [ ] Verify evaluation data appears in D1
- [ ] Verify telemetry data appears in D1
- [ ] Verify batch data appears in D1
- [ ] Test with `ZE_BENCHMARKS_AUTO_SYNC=false` (if implemented)
- [ ] Test without `.env` file (should fall back to localhost)

---

## Summary

**Problem**: Environment variables not loading because `dotenv.config()` called without path argument.

**Solution**: Change line 13 in `packages/worker-client/src/client.ts`:
```diff
- config();
+ config({ path: resolve(process.cwd(), '.env') });
```

**Impact**:
- ✅ Worker URL will be correctly loaded from `.env`
- ✅ Data will sync to D1 production database
- ✅ Consistent behavior across all packages

**Estimated Fix Time**: 2 minutes
**Testing Time**: 5 minutes

---

**Status**: Ready to implement
**Next Action**: Apply fix to `packages/worker-client/src/client.ts`
