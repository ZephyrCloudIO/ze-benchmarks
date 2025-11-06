# Cloudflare Worker + D1 Implementation Plan

## Overview

This document outlines the implementation plan for migrating ze-benchmarks to a unified Cloudflare Worker + D1 Database architecture that works consistently in both local development and production environments.

### Current Architecture
- **Database**: SQLite file (`benchmark-report/public/benchmarks.db`)
- **CLI**: Node.js-based harness that runs benchmarks and writes to SQLite file
- **Frontend**: React dashboard using sql.js to read the SQLite file directly in browser
- **No server**: Everything is file-based and stateless

### Target Architecture (Unified: Local + Production)

Both local development and production use the **exact same architecture**:

```
CLI → POST to Worker API → D1 Database
                              ↓
           Frontend → GET from Worker API
```

**Local Development:**
- Worker runs via `wrangler dev` (localhost:8787)
- D1 is a local SQLite database (managed by wrangler)
- CLI posts to `http://localhost:8787`
- Frontend fetches from `http://localhost:8787`

**Production:**
- Worker runs on Cloudflare edge
- D1 is production Cloudflare database
- CI/CD posts to `https://worker.workers.dev`
- Frontend (on Zephyr) fetches from `https://worker.workers.dev`

### Benefits
✅ **Single code path** - Same logic for local and production
✅ **Test the real thing** - Local dev tests actual Worker behavior
✅ **No file sync issues** - Real-time updates via HTTP
✅ **Simplified frontend** - No sql.js, just HTTP calls
✅ **Easy orchestration** - All services start with one command

---

## 1. Cloudflare Worker Directory Structure

```
worker/
├── wrangler.toml                 # Cloudflare configuration
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── src/
│   ├── index.ts                  # Main worker entry point
│   ├── router.ts                 # Request router
│   ├── api/
│   │   ├── runs.ts               # Benchmark runs endpoints
│   │   ├── batches.ts            # Batch operations
│   │   ├── stats.ts              # Statistics endpoints
│   │   ├── submit.ts             # Result submission (POST)
│   │   └── types.ts              # Shared types
│   ├── db/
│   │   ├── queries.ts            # D1 query functions
│   │   └── migrations/
│   │       └── 0001_initial.sql  # Schema migration
│   ├── middleware/
│   │   ├── cors.ts               # CORS handling
│   │   ├── auth.ts               # API key validation
│   │   └── error.ts              # Error handling
│   └── utils/
│       ├── response.ts           # Response helpers
│       └── validation.ts         # Request validation
```

---

## 2. Configuration Files

### wrangler.toml

```toml
name = "ze-benchmarks-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[ d1_databases ]]
binding = "DB"
database_name = "ze-benchmarks"
database_id = "<your-d1-database-id>"

[vars]
ENVIRONMENT = "production"

# For secrets (use wrangler secret put)
# - API_SECRET_KEY: For POST /api/results authentication
```

### package.json

```json
{
  "name": "ze-benchmarks-worker",
  "version": "1.0.0",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "migrations:create": "wrangler d1 migrations create ze-benchmarks",
    "migrations:apply": "wrangler d1 migrations apply ze-benchmarks"
  },
  "dependencies": {
    "itty-router": "^4.0.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240000.0",
    "wrangler": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

---

## 3. Database Schema (D1 Migration)

### src/db/migrations/0001_initial.sql

```sql
-- Batch runs table
CREATE TABLE IF NOT EXISTS batch_runs (
  batchId TEXT PRIMARY KEY,
  createdAt INTEGER NOT NULL,
  completedAt INTEGER,
  totalRuns INTEGER DEFAULT 0,
  successfulRuns INTEGER DEFAULT 0,
  avgScore REAL,
  avgWeightedScore REAL,
  metadata TEXT
);

-- Benchmark runs table
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT UNIQUE NOT NULL,
  batchId TEXT,
  suite TEXT NOT NULL,
  scenario TEXT NOT NULL,
  tier TEXT NOT NULL,
  agent TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  total_score REAL,
  weighted_score REAL,
  is_successful INTEGER DEFAULT 0,
  success_metric REAL,
  metadata TEXT,
  FOREIGN KEY (batchId) REFERENCES batch_runs(batchId)
);

-- Evaluation results table
CREATE TABLE IF NOT EXISTS evaluation_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  evaluator_name TEXT NOT NULL,
  score REAL NOT NULL,
  max_score REAL NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES benchmark_runs(run_id)
);

-- Run telemetry table
CREATE TABLE IF NOT EXISTS run_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  tool_calls INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd REAL,
  duration_ms INTEGER,
  workspace_dir TEXT,
  FOREIGN KEY (run_id) REFERENCES benchmark_runs(run_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_runs_suite_scenario ON benchmark_runs(suite, scenario);
CREATE INDEX IF NOT EXISTS idx_runs_agent ON benchmark_runs(agent);
CREATE INDEX IF NOT EXISTS idx_runs_status ON benchmark_runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_batchId ON benchmark_runs(batchId);
CREATE INDEX IF NOT EXISTS idx_runs_is_successful ON benchmark_runs(is_successful);
CREATE INDEX IF NOT EXISTS idx_evals_run_id ON evaluation_results(run_id);
```

---

## 4. Worker Implementation

### src/index.ts

```typescript
import { Router } from 'itty-router';
import { corsHeaders, handleCors } from './middleware/cors';
import { errorHandler } from './middleware/error';
import { authenticate } from './middleware/auth';
import * as runsApi from './api/runs';
import * as batchesApi from './api/batches';
import * as statsApi from './api/stats';
import * as submitApi from './api/submit';

export interface Env {
  DB: D1Database;
  API_SECRET_KEY: string;
  ENVIRONMENT: string;
}

const router = Router();

// CORS preflight
router.options('*', handleCors);

// Public read endpoints (no auth required)
router.get('/api/runs', runsApi.listRuns);
router.get('/api/runs/:runId', runsApi.getRunDetails);
router.get('/api/runs/:runId/evaluations', runsApi.getRunEvaluations);
router.get('/api/runs/:runId/telemetry', runsApi.getRunTelemetry);

router.get('/api/batches', batchesApi.listBatches);
router.get('/api/batches/:batchId', batchesApi.getBatchDetails);
router.get('/api/batches/:batchId/analytics', batchesApi.getBatchAnalytics);
router.get('/api/batches/compare', batchesApi.compareBatches); // ?ids=batch1,batch2

router.get('/api/stats', statsApi.getGlobalStats);
router.get('/api/stats/agents', statsApi.getAgentStats);
router.get('/api/stats/suites/:suite', statsApi.getSuiteStats);
router.get('/api/stats/scenarios/:suite/:scenario', statsApi.getScenarioStats);
router.get('/api/stats/models', statsApi.getModelStats);
router.get('/api/stats/evaluators/:name/trends', statsApi.getEvaluatorTrends);

// Protected write endpoint (requires authentication)
router.post('/api/results', authenticate, submitApi.submitResults);
router.post('/api/results/batch', authenticate, submitApi.submitBatchResults);

// Health check
router.get('/health', () =>
  new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'content-type': 'application/json', ...corsHeaders }
  })
);

// 404 handler
router.all('*', () =>
  new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'content-type': 'application/json', ...corsHeaders }
  })
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await router.handle(request, env, ctx).catch(errorHandler);
    } catch (err) {
      return errorHandler(err);
    }
  },
};
```

---

## 5. API Endpoints

### src/api/runs.ts

```typescript
import { Env } from '../index';
import { jsonResponse } from '../utils/response';
import * as queries from '../db/queries';

export async function listRuns(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const suite = url.searchParams.get('suite');
  const scenario = url.searchParams.get('scenario');
  const agent = url.searchParams.get('agent');
  const status = url.searchParams.get('status');

  const runs = await queries.getRunHistory(env.DB, {
    limit,
    suite: suite || undefined,
    scenario: scenario || undefined,
    agent: agent || undefined,
    status: status as any || undefined
  });

  return jsonResponse(runs);
}

export async function getRunDetails(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const runId = url.pathname.split('/').pop();

  if (!runId) {
    return jsonResponse({ error: 'Run ID required' }, 400);
  }

  const run = await queries.getRunById(env.DB, runId);

  if (!run) {
    return jsonResponse({ error: 'Run not found' }, 404);
  }

  return jsonResponse(run);
}

export async function getRunEvaluations(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const runId = url.pathname.split('/')[3]; // /api/runs/:runId/evaluations

  const evaluations = await queries.getEvaluationsByRunId(env.DB, runId);
  return jsonResponse(evaluations);
}

export async function getRunTelemetry(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const runId = url.pathname.split('/')[3]; // /api/runs/:runId/telemetry

  const telemetry = await queries.getTelemetryByRunId(env.DB, runId);
  return jsonResponse(telemetry || null);
}
```

### src/api/batches.ts

```typescript
import { Env } from '../index';
import { jsonResponse } from '../utils/response';
import * as queries from '../db/queries';

export async function listBatches(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const status = url.searchParams.get('status');
  const sortBy = url.searchParams.get('sortBy') || 'date';

  const batches = await queries.getBatchHistory(env.DB, {
    limit,
    status: status as any,
    sortBy: sortBy as any
  });

  return jsonResponse(batches);
}

export async function getBatchDetails(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const batchId = url.pathname.split('/').pop();

  if (!batchId) {
    return jsonResponse({ error: 'Batch ID required' }, 400);
  }

  const batch = await queries.getBatchById(env.DB, batchId);

  if (!batch) {
    return jsonResponse({ error: 'Batch not found' }, 404);
  }

  return jsonResponse(batch);
}

export async function getBatchAnalytics(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const batchId = url.pathname.split('/')[3];

  const analytics = await queries.getBatchAnalytics(env.DB, batchId);
  return jsonResponse(analytics);
}

export async function compareBatches(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get('ids');

  if (!idsParam) {
    return jsonResponse({ error: 'Batch IDs required (query param: ids)' }, 400);
  }

  const batchIds = idsParam.split(',');
  const comparison = await queries.compareBatches(env.DB, batchIds);

  return jsonResponse(comparison);
}
```

### src/api/stats.ts

```typescript
import { Env } from '../index';
import { jsonResponse } from '../utils/response';
import * as queries from '../db/queries';

export async function getGlobalStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');

  const stats = await queries.getGlobalStatistics(env.DB, { days });
  return jsonResponse(stats);
}

export async function getAgentStats(request: Request, env: Env): Promise<Response> {
  const stats = await queries.getAgentPerformanceStats(env.DB);
  return jsonResponse(stats);
}

export async function getSuiteStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const suite = url.pathname.split('/').pop();

  if (!suite) {
    return jsonResponse({ error: 'Suite required' }, 400);
  }

  const stats = await queries.getSuiteStatistics(env.DB, suite);
  return jsonResponse(stats);
}

export async function getScenarioStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const suite = parts[parts.length - 2];
  const scenario = parts[parts.length - 1];

  if (!suite || !scenario) {
    return jsonResponse({ error: 'Suite and scenario required' }, 400);
  }

  const stats = await queries.getScenarioStatistics(env.DB, suite, scenario);
  return jsonResponse(stats);
}

export async function getModelStats(request: Request, env: Env): Promise<Response> {
  const stats = await queries.getModelPerformanceStats(env.DB);
  return jsonResponse(stats);
}

export async function getEvaluatorTrends(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const name = url.pathname.split('/')[4]; // /api/stats/evaluators/:name/trends
  const days = parseInt(url.searchParams.get('days') || '30');

  if (!name) {
    return jsonResponse({ error: 'Evaluator name required' }, 400);
  }

  const trends = await queries.getEvaluatorTrends(env.DB, name, days);
  return jsonResponse(trends);
}
```

### src/api/submit.ts

```typescript
import { Env } from '../index';
import { jsonResponse } from '../utils/response';
import * as queries from '../db/queries';

export interface SubmitResultsPayload {
  runId: string;
  batchId?: string;
  suite: string;
  scenario: string;
  tier: string;
  agent: string;
  model?: string;
  status: 'completed' | 'failed';
  startedAt: string;
  completedAt: string;
  totalScore?: number;
  weightedScore?: number;
  isSuccessful: boolean;
  successMetric?: number;
  metadata?: Record<string, any>;
  evaluations: Array<{
    evaluatorName: string;
    score: number;
    maxScore: number;
    details?: string;
  }>;
  telemetry?: {
    toolCalls?: number;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
    durationMs?: number;
    workspaceDir?: string;
  };
}

export async function submitResults(request: Request, env: Env): Promise<Response> {
  try {
    const payload: SubmitResultsPayload = await request.json();

    // Validate payload
    if (!payload.runId || !payload.suite || !payload.scenario || !payload.tier || !payload.agent) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    // Insert benchmark run
    await queries.insertRun(env.DB, {
      runId: payload.runId,
      batchId: payload.batchId,
      suite: payload.suite,
      scenario: payload.scenario,
      tier: payload.tier,
      agent: payload.agent,
      model: payload.model,
      status: payload.status,
      startedAt: payload.startedAt,
      completedAt: payload.completedAt,
      totalScore: payload.totalScore,
      weightedScore: payload.weightedScore,
      isSuccessful: payload.isSuccessful,
      successMetric: payload.successMetric,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : undefined
    });

    // Insert evaluations
    for (const evaluation of payload.evaluations) {
      await queries.insertEvaluation(env.DB, {
        runId: payload.runId,
        evaluatorName: evaluation.evaluatorName,
        score: evaluation.score,
        maxScore: evaluation.maxScore,
        details: evaluation.details
      });
    }

    // Insert telemetry
    if (payload.telemetry) {
      await queries.insertTelemetry(env.DB, {
        runId: payload.runId,
        ...payload.telemetry
      });
    }

    return jsonResponse({ success: true, runId: payload.runId }, 201);
  } catch (err) {
    console.error('Failed to submit results:', err);
    return jsonResponse({ error: 'Failed to submit results' }, 500);
  }
}

export async function submitBatchResults(request: Request, env: Env): Promise<Response> {
  try {
    const payload = await request.json();

    // Validate
    if (!payload.batchId) {
      return jsonResponse({ error: 'batchId required' }, 400);
    }

    // Create or update batch
    await queries.insertOrUpdateBatch(env.DB, {
      batchId: payload.batchId,
      createdAt: payload.createdAt || Date.now(),
      completedAt: payload.completedAt,
      totalRuns: payload.totalRuns,
      successfulRuns: payload.successfulRuns,
      avgScore: payload.avgScore,
      avgWeightedScore: payload.avgWeightedScore,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : undefined
    });

    return jsonResponse({ success: true, batchId: payload.batchId }, 201);
  } catch (err) {
    console.error('Failed to submit batch:', err);
    return jsonResponse({ error: 'Failed to submit batch results' }, 500);
  }
}
```

---

## 6. Database Queries

### src/db/queries.ts

```typescript
// Run queries
export async function getRunHistory(db: D1Database, filters: {
  limit: number;
  suite?: string;
  scenario?: string;
  agent?: string;
  status?: string;
}) {
  let query = 'SELECT * FROM benchmark_runs WHERE 1=1';
  const params: any[] = [];

  if (filters.suite) {
    query += ' AND suite = ?';
    params.push(filters.suite);
  }
  if (filters.scenario) {
    query += ' AND scenario = ?';
    params.push(filters.scenario);
  }
  if (filters.agent) {
    query += ' AND agent = ?';
    params.push(filters.agent);
  }
  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY started_at DESC LIMIT ?';
  params.push(filters.limit);

  const result = await db.prepare(query).bind(...params).all();
  return result.results;
}

export async function getRunById(db: D1Database, runId: string) {
  const run = await db.prepare(
    'SELECT * FROM benchmark_runs WHERE run_id = ?'
  ).bind(runId).first();

  if (!run) return null;

  const evaluations = await db.prepare(
    'SELECT * FROM evaluation_results WHERE run_id = ?'
  ).bind(runId).all();

  const telemetry = await db.prepare(
    'SELECT * FROM run_telemetry WHERE run_id = ?'
  ).bind(runId).first();

  return {
    run,
    evaluations: evaluations.results,
    telemetry
  };
}

export async function getEvaluationsByRunId(db: D1Database, runId: string) {
  const result = await db.prepare(
    'SELECT * FROM evaluation_results WHERE run_id = ? ORDER BY created_at'
  ).bind(runId).all();

  return result.results;
}

export async function getTelemetryByRunId(db: D1Database, runId: string) {
  return await db.prepare(
    'SELECT * FROM run_telemetry WHERE run_id = ?'
  ).bind(runId).first();
}

// Batch queries
export async function getBatchHistory(db: D1Database, filters: {
  limit: number;
  status?: 'completed' | 'running';
  sortBy?: 'date' | 'score';
}) {
  let query = 'SELECT * FROM batch_runs WHERE 1=1';
  const params: any[] = [];

  if (filters.status === 'completed') {
    query += ' AND completedAt IS NOT NULL';
  } else if (filters.status === 'running') {
    query += ' AND completedAt IS NULL';
  }

  const orderBy = filters.sortBy === 'score'
    ? 'ORDER BY avgWeightedScore DESC, createdAt DESC'
    : 'ORDER BY createdAt DESC';

  query += ` ${orderBy} LIMIT ?`;
  params.push(filters.limit);

  const result = await db.prepare(query).bind(...params).all();
  return result.results;
}

export async function getBatchById(db: D1Database, batchId: string) {
  const batch = await db.prepare(
    'SELECT * FROM batch_runs WHERE batchId = ?'
  ).bind(batchId).first();

  if (!batch) return null;

  const runs = await db.prepare(
    'SELECT * FROM benchmark_runs WHERE batchId = ? ORDER BY started_at'
  ).bind(batchId).all();

  return {
    ...batch,
    runs: runs.results
  };
}

export async function getBatchAnalytics(db: D1Database, batchId: string) {
  // Suite/scenario breakdown
  const suiteBreakdown = await db.prepare(`
    SELECT
      suite,
      scenario,
      COUNT(*) as runs,
      COUNT(CASE WHEN status = 'completed' AND is_successful = 1 THEN 1 END) as successfulRuns,
      AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN total_score END) as avgScore,
      AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as avgWeightedScore
    FROM benchmark_runs
    WHERE batchId = ?
    GROUP BY suite, scenario
    ORDER BY suite, scenario
  `).bind(batchId).all();

  // Agent performance comparison
  const agentPerformance = await db.prepare(`
    SELECT
      agent,
      model,
      COUNT(*) as runs,
      COUNT(CASE WHEN status = 'completed' AND is_successful = 1 THEN 1 END) as successfulRuns,
      AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as avgWeightedScore,
      MIN(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as minScore,
      MAX(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as maxScore
    FROM benchmark_runs
    WHERE batchId = ?
    GROUP BY agent, model
    ORDER BY avgWeightedScore DESC
  `).bind(batchId).all();

  // Evaluator breakdown
  const evaluatorBreakdown = await db.prepare(`
    SELECT
      er.evaluator_name as evaluatorName,
      AVG(er.score) as avgScore,
      MAX(er.max_score) as maxScore,
      COUNT(*) as count
    FROM evaluation_results er
    JOIN benchmark_runs br ON er.run_id = br.run_id
    WHERE br.batchId = ? AND br.status = 'completed' AND br.is_successful = 1
    GROUP BY er.evaluator_name
    ORDER BY avgScore DESC
  `).bind(batchId).all();

  return {
    suiteBreakdown: suiteBreakdown.results,
    agentPerformance: agentPerformance.results,
    evaluatorBreakdown: evaluatorBreakdown.results
  };
}

export async function compareBatches(db: D1Database, batchIds: string[]) {
  const placeholders = batchIds.map(() => '?').join(',');
  const result = await db.prepare(`
    SELECT
      batchId,
      createdAt,
      completedAt,
      totalRuns,
      successfulRuns,
      avgScore,
      avgWeightedScore
    FROM batch_runs
    WHERE batchId IN (${placeholders})
    ORDER BY createdAt DESC
  `).bind(...batchIds).all();

  return result.results;
}

// Statistics queries
export async function getGlobalStatistics(db: D1Database, filters: { days: number }) {
  const result = await db.prepare(`
    SELECT
      COUNT(*) as totalRuns,
      COUNT(CASE WHEN status = 'completed' AND is_successful = 1 THEN 1 END) as successfulRuns,
      AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN total_score END) as avgScore,
      AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as avgWeightedScore
    FROM benchmark_runs
    WHERE started_at >= datetime('now', '-' || ? || ' days')
  `).bind(filters.days).first();

  return result;
}

export async function getAgentPerformanceStats(db: D1Database) {
  const result = await db.prepare(`
    SELECT
      agent,
      COUNT(*) as runs,
      AVG(weighted_score) as avgScore,
      MIN(weighted_score) as minScore,
      MAX(weighted_score) as maxScore
    FROM benchmark_runs
    WHERE status = 'completed' AND is_successful = 1 AND weighted_score IS NOT NULL
    GROUP BY agent
    ORDER BY avgScore DESC
  `).all();

  return result.results;
}

export async function getSuiteStatistics(db: D1Database, suite: string) {
  const stats = await db.prepare(`
    SELECT
      COUNT(*) as totalRuns,
      COUNT(CASE WHEN status = 'completed' AND is_successful = 1 THEN 1 END) as successfulRuns,
      AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN total_score END) as avgScore,
      AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as avgWeightedScore
    FROM benchmark_runs
    WHERE suite = ?
  `).bind(suite).first();

  const scenarioBreakdown = await db.prepare(`
    SELECT
      scenario,
      COUNT(*) as runs,
      AVG(total_score) as avgScore
    FROM benchmark_runs
    WHERE suite = ? AND status = 'completed' AND is_successful = 1
    GROUP BY scenario
  `).bind(suite).all();

  return {
    ...stats,
    scenarioBreakdown: scenarioBreakdown.results
  };
}

export async function getScenarioStatistics(db: D1Database, suite: string, scenario: string) {
  const stats = await db.prepare(`
    SELECT
      COUNT(*) as totalRuns,
      COUNT(CASE WHEN status = 'completed' AND is_successful = 1 THEN 1 END) as successfulRuns,
      AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN total_score END) as avgScore,
      AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as avgWeightedScore,
      MIN(weighted_score) as minScore,
      MAX(weighted_score) as maxScore
    FROM benchmark_runs
    WHERE suite = ? AND scenario = ?
  `).bind(suite, scenario).first();

  const agentComparison = await db.prepare(`
    SELECT
      agent,
      COUNT(*) as runs,
      AVG(total_score) as avgScore
    FROM benchmark_runs
    WHERE suite = ? AND scenario = ? AND status = 'completed' AND is_successful = 1
    GROUP BY agent
    ORDER BY avgScore DESC
  `).bind(suite, scenario).all();

  return {
    ...stats,
    agentComparison: agentComparison.results
  };
}

export async function getModelPerformanceStats(db: D1Database) {
  const result = await db.prepare(`
    SELECT
      model,
      COUNT(*) as runs,
      AVG(weighted_score) as avgScore,
      MIN(weighted_score) as minScore,
      MAX(weighted_score) as maxScore
    FROM benchmark_runs
    WHERE status = 'completed' AND is_successful = 1 AND model IS NOT NULL AND model != 'default'
    GROUP BY model
    ORDER BY avgScore DESC
  `).all();

  return result.results;
}

export async function getEvaluatorTrends(db: D1Database, evaluatorName: string, days: number) {
  const result = await db.prepare(`
    SELECT
      DATE(created_at) as date,
      AVG(score) as avgScore,
      COUNT(*) as count
    FROM evaluation_results
    WHERE evaluator_name = ?
      AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY DATE(created_at)
    ORDER BY date
  `).bind(evaluatorName, days).all();

  return result.results;
}

// Write operations
export async function insertRun(db: D1Database, data: any) {
  return await db.prepare(`
    INSERT INTO benchmark_runs (
      run_id, batchId, suite, scenario, tier, agent, model, status,
      started_at, completed_at, total_score, weighted_score,
      is_successful, success_metric, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.runId, data.batchId, data.suite, data.scenario, data.tier,
    data.agent, data.model, data.status, data.startedAt, data.completedAt,
    data.totalScore, data.weightedScore, data.isSuccessful ? 1 : 0,
    data.successMetric, data.metadata
  ).run();
}

export async function insertEvaluation(db: D1Database, data: any) {
  return await db.prepare(`
    INSERT INTO evaluation_results (run_id, evaluator_name, score, max_score, details)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    data.runId, data.evaluatorName, data.score, data.maxScore, data.details
  ).run();
}

export async function insertTelemetry(db: D1Database, data: any) {
  return await db.prepare(`
    INSERT INTO run_telemetry (
      run_id, tool_calls, tokens_in, tokens_out, cost_usd, duration_ms, workspace_dir
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.runId, data.toolCalls, data.tokensIn, data.tokensOut,
    data.costUsd, data.durationMs, data.workspaceDir
  ).run();
}

export async function insertOrUpdateBatch(db: D1Database, data: any) {
  return await db.prepare(`
    INSERT INTO batch_runs (
      batchId, createdAt, completedAt, totalRuns, successfulRuns,
      avgScore, avgWeightedScore, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(batchId) DO UPDATE SET
      completedAt = excluded.completedAt,
      totalRuns = excluded.totalRuns,
      successfulRuns = excluded.successfulRuns,
      avgScore = excluded.avgScore,
      avgWeightedScore = excluded.avgWeightedScore,
      metadata = excluded.metadata
  `).bind(
    data.batchId, data.createdAt, data.completedAt, data.totalRuns,
    data.successfulRuns, data.avgScore, data.avgWeightedScore, data.metadata
  ).run();
}
```

---

## 7. Middleware

### src/middleware/cors.ts

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function handleCors() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
```

### src/middleware/auth.ts

```typescript
import { Env } from '../index';
import { jsonResponse } from '../utils/response';

export async function authenticate(
  request: Request,
  env: Env
): Promise<Response | void> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);

  if (token !== env.API_SECRET_KEY) {
    return jsonResponse({ error: 'Invalid API key' }, 403);
  }

  // Authentication successful, continue
}
```

### src/middleware/error.ts

```typescript
import { jsonResponse } from '../utils/response';

export function errorHandler(err: any): Response {
  console.error('Error:', err);

  return jsonResponse(
    {
      error: err.message || 'Internal server error',
      ...(process.env.ENVIRONMENT === 'development' && { stack: err.stack })
    },
    500
  );
}
```

### src/utils/response.ts

```typescript
import { corsHeaders } from '../middleware/cors';

export function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders
    }
  });
}
```

---

## 8. CLI Modifications

The CLI needs to be updated to POST results to the Worker API instead of writing directly to SQLite.

### packages/database/src/logger.ts - Add HTTP Submission

```typescript
import { BenchmarkRun, EvaluationResult, RunTelemetry } from './schema';

export class BenchmarkLogger {
  private static instance: BenchmarkLogger | null = null;
  private currentRunId: string | null = null;
  private currentBatchId: string | null = null;
  private workerUrl: string | null = null;
  private apiKey: string | null = null;

  // Store data in memory to submit at the end
  private pendingRun: any = null;
  private pendingEvaluations: any[] = [];
  private pendingTelemetry: any = null;

  constructor() {
    this.workerUrl = process.env.ZE_BENCHMARKS_WORKER_URL || null;
    this.apiKey = process.env.ZE_BENCHMARKS_API_KEY || 'dev-local-key';

    if (!this.workerUrl) {
      console.warn('⚠️  ZE_BENCHMARKS_WORKER_URL not set. Results will not be submitted.');
      console.warn('   Set it to http://localhost:8787 for local development');
    }
  }

  static getInstance(): BenchmarkLogger {
    if (!BenchmarkLogger.instance) {
      BenchmarkLogger.instance = new BenchmarkLogger();
    }
    return BenchmarkLogger.instance;
  }

  startRun(suite: string, scenario: string, tier: string, agent: string, model?: string, batchId?: string): string {
    const runId = uuidv4();
    this.currentRunId = runId;
    this.currentBatchId = batchId;

    this.pendingRun = {
      runId,
      batchId,
      suite,
      scenario,
      tier,
      agent,
      model,
      status: 'running',
      startedAt: new Date().toISOString()
    };

    console.log(`📊 Started benchmark run: ${runId}`);
    return runId;
  }

  completeRun(totalScore?: number, weightedScore?: number, metadata?: Record<string, any>, isSuccessful?: boolean, successMetric?: number) {
    if (!this.currentRunId) throw new Error('No active run');

    this.pendingRun = {
      ...this.pendingRun,
      status: 'completed',
      completedAt: new Date().toISOString(),
      totalScore,
      weightedScore,
      isSuccessful,
      successMetric,
      metadata
    };

    // Submit to Worker API
    this.submitToWorker();
  }

  failRun(error: string, errorType?: 'workspace' | 'prompt' | 'agent' | 'evaluation' | 'unknown') {
    if (!this.currentRunId) throw new Error('No active run');

    this.pendingRun = {
      ...this.pendingRun,
      status: 'failed',
      completedAt: new Date().toISOString(),
      metadata: { error, errorType: errorType || 'unknown' }
    };

    // Submit to Worker API
    this.submitToWorker();
  }

  logEvaluation(evaluatorName: string, score: number, maxScore: number, details?: string) {
    if (!this.currentRunId) throw new Error('No active run');

    this.pendingEvaluations.push({
      evaluatorName,
      score,
      maxScore,
      details
    });
  }

  logTelemetry(toolCalls?: number, tokensIn?: number, tokensOut?: number, costUsd?: number, durationMs?: number, workspaceDir?: string) {
    if (!this.currentRunId) throw new Error('No active run');

    this.pendingTelemetry = {
      toolCalls,
      tokensIn,
      tokensOut,
      costUsd,
      durationMs,
      workspaceDir
    };
  }

  private async submitToWorker() {
    if (!this.workerUrl) {
      console.log('⚠️  Skipping Worker submission (no URL configured)');
      return;
    }

    try {
      const payload = {
        ...this.pendingRun,
        evaluations: this.pendingEvaluations,
        telemetry: this.pendingTelemetry
      };

      console.log(`📤 Submitting results to ${this.workerUrl}/api/results`);

      const response = await fetch(`${this.workerUrl}/api/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      const result = await response.json();
      console.log(`✅ Results submitted successfully: ${result.runId}`);

      // Clear pending data
      this.pendingRun = null;
      this.pendingEvaluations = [];
      this.pendingTelemetry = null;
    } catch (error) {
      console.error('❌ Failed to submit results to Worker:', error.message);
      console.error('   Results were not persisted to database');
      throw error;
    }
  }

  // Keep existing methods for backwards compatibility during migration
  // These will be removed once we fully migrate
  getRunHistory() { throw new Error('Use Worker API instead'); }
  getRunDetails() { throw new Error('Use Worker API instead'); }
  // ... etc
}
```

### Environment Variables

Users set these before running benchmarks:

**Local Development:**
```bash
export ZE_BENCHMARKS_WORKER_URL=http://localhost:8787
export ZE_BENCHMARKS_API_KEY=dev-local-key
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic
```

**Production (CI/CD):**
```yaml
env:
  ZE_BENCHMARKS_WORKER_URL: ${{ secrets.WORKER_URL }}
  ZE_BENCHMARKS_API_KEY: ${{ secrets.BENCHMARK_API_KEY }}
```

---

## 9. Local Development Orchestration

Use mprocs to start all services with a single command.

### mprocs.yaml (NEW FILE - Root Directory)

```yaml
procs:
  worker:
    cmd: cd worker && pnpm dev
    stop: SIGTERM
    autostart: true

  frontend:
    cmd: cd benchmark-report && pnpm dev
    stop: SIGTERM
    autostart: true
    env:
      VITE_API_URL: http://localhost:8787

keymap:
  toggle-focus: Ctrl+A

keymap_procs:
  add: A
  focus-next: J
  focus-prev: K
  quit: Q
  restart: R
  start: S
  stop: X
  term: Ctrl+C

hide_keymap_window: false
```

### package.json - Add Dev Script

```json
{
  "scripts": {
    "dev": "mprocs",
    "dev:worker": "cd worker && pnpm dev",
    "dev:frontend": "cd benchmark-report && pnpm dev"
  },
  "devDependencies": {
    "mprocs": "^0.6.4"
  }
}
```

### Single Command Startup

```bash
# Install mprocs globally (one-time setup)
cargo install mprocs
# OR
npm install -g mprocs

# Start everything
pnpm dev
```

This launches:
1. **Worker** on `http://localhost:8787` (with local D1)
2. **Frontend** on `http://localhost:3000` (configured to use localhost:8787)

Then run benchmarks in another terminal:
```bash
export ZE_BENCHMARKS_WORKER_URL=http://localhost:8787
export ZE_BENCHMARKS_API_KEY=dev-local-key
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic
```

Results will flow: CLI → Worker → D1 → Frontend (auto-updates)

### Alternative: npm-run-all (if mprocs not available)

```json
{
  "scripts": {
    "dev": "npm-run-all --parallel dev:*",
    "dev:worker": "cd worker && pnpm dev",
    "dev:frontend": "VITE_API_URL=http://localhost:8787 cd benchmark-report && pnpm dev"
  },
  "devDependencies": {
    "npm-run-all": "^4.1.5"
  }
}
```

---

## 10. Frontend Updates

### benchmark-report/src/lib/api-client.ts (NEW FILE)

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://your-worker.workers.dev';

export async function fetchRuns(filters?: {
  limit?: number;
  suite?: string;
  scenario?: string;
  agent?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value.toString());
    });
  }

  const response = await fetch(`${API_BASE_URL}/api/runs?${params}`);
  if (!response.ok) throw new Error('Failed to fetch runs');
  return response.json();
}

export async function fetchRunDetails(runId: string) {
  const response = await fetch(`${API_BASE_URL}/api/runs/${runId}`);
  if (!response.ok) throw new Error('Failed to fetch run details');
  return response.json();
}

export async function fetchBatches(filters?: {
  limit?: number;
  status?: string;
  sortBy?: string;
}) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value.toString());
    });
  }

  const response = await fetch(`${API_BASE_URL}/api/batches?${params}`);
  if (!response.ok) throw new Error('Failed to fetch batches');
  return response.json();
}

export async function fetchBatchDetails(batchId: string) {
  const response = await fetch(`${API_BASE_URL}/api/batches/${batchId}`);
  if (!response.ok) throw new Error('Failed to fetch batch details');
  return response.json();
}

export async function fetchBatchAnalytics(batchId: string) {
  const response = await fetch(`${API_BASE_URL}/api/batches/${batchId}/analytics`);
  if (!response.ok) throw new Error('Failed to fetch batch analytics');
  return response.json();
}

export async function fetchGlobalStats(days: number = 30) {
  const response = await fetch(`${API_BASE_URL}/api/stats?days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export async function fetchAgentStats() {
  const response = await fetch(`${API_BASE_URL}/api/stats/agents`);
  if (!response.ok) throw new Error('Failed to fetch agent stats');
  return response.json();
}

export async function fetchSuiteStats(suite: string) {
  const response = await fetch(`${API_BASE_URL}/api/stats/suites/${suite}`);
  if (!response.ok) throw new Error('Failed to fetch suite stats');
  return response.json();
}

export async function fetchScenarioStats(suite: string, scenario: string) {
  const response = await fetch(`${API_BASE_URL}/api/stats/scenarios/${suite}/${scenario}`);
  if (!response.ok) throw new Error('Failed to fetch scenario stats');
  return response.json();
}

export async function fetchModelStats() {
  const response = await fetch(`${API_BASE_URL}/api/stats/models`);
  if (!response.ok) throw new Error('Failed to fetch model stats');
  return response.json();
}

export async function fetchEvaluatorTrends(name: string, days: number = 30) {
  const response = await fetch(`${API_BASE_URL}/api/stats/evaluators/${name}/trends?days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch evaluator trends');
  return response.json();
}
```

### Environment Configuration

Create `.env` file in `benchmark-report/`:

```env
VITE_API_URL=https://ze-benchmarks-api.workers.dev
```

---

## 11. CI/CD Integration

### .github/workflows/benchmarks.yml (UPDATE EXISTING)

```yaml
name: Run Benchmarks

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install

      - name: Run benchmarks
        env:
          # Agent API keys
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          # Worker API for result submission
          ZE_BENCHMARKS_WORKER_URL: ${{ secrets.WORKER_URL }}
          ZE_BENCHMARKS_API_KEY: ${{ secrets.BENCHMARK_API_KEY }}
        run: |
          # CLI will automatically POST results to Worker
          pnpm bench update-deps nx-pnpm-monorepo L1 anthropic
```

---

## 12. Deployment Steps

### Step 1: Setup Cloudflare Account

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### Step 2: Create D1 Database

```bash
# Create the database
wrangler d1 create ze-benchmarks

# Output will include database_id - copy this to wrangler.toml
```

### Step 3: Apply Migrations

```bash
# Apply the initial schema
wrangler d1 migrations apply ze-benchmarks --remote
```

### Step 4: Set Secrets

```bash
# Set the API secret key
wrangler secret put API_SECRET_KEY
# Enter a secure random key when prompted
```

### Step 5: Deploy Worker

```bash
cd worker
pnpm install
pnpm deploy
```

### Step 6: Configure Frontend

Update `benchmark-report/.env`:
```env
VITE_API_URL=https://ze-benchmarks-api.<your-subdomain>.workers.dev
```

### Step 7: Setup GitHub Secrets

Add these secrets to GitHub repository:
- `BENCHMARK_API_KEY`: Same value as API_SECRET_KEY in Worker
- `WORKER_URL`: Your Worker URL

---

## 13. Local Testing

### Option 1: Complete Flow Test (Recommended)

```bash
# Terminal 1: Start all services
pnpm dev

# Terminal 2: Run a benchmark
export ZE_BENCHMARKS_WORKER_URL=http://localhost:8787
export ZE_BENCHMARKS_API_KEY=dev-local-key
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic

# View results at http://localhost:3000
```

### Option 2: Manual API Testing

```bash
# Start Worker
cd worker && pnpm dev

# Test health
curl http://localhost:8787/health

# Test GET endpoints
curl http://localhost:8787/api/runs
curl http://localhost:8787/api/batches

# Test POST (submit result)
curl -X POST http://localhost:8787/api/results \
  -H "Authorization: Bearer dev-local-key" \
  -H "Content-Type: application/json" \
  -d '{
    "runId": "test-123",
    "suite": "update-deps",
    "scenario": "nx-pnpm-monorepo",
    "tier": "L1",
    "agent": "anthropic",
    "status": "completed",
    "startedAt": "2024-01-01T00:00:00Z",
    "completedAt": "2024-01-01T00:05:00Z",
    "totalScore": 8.5,
    "weightedScore": 8.2,
    "isSuccessful": true,
    "evaluations": [],
    "telemetry": {}
  }'
```

---

## 14. Migration Checklist

- [ ] Create Worker directory structure
- [ ] Implement all API endpoints
- [ ] Write database queries
- [ ] Setup middleware (CORS, auth, error handling)
- [ ] Create D1 database in Cloudflare (local + remote)
- [ ] Apply schema migrations
- [ ] Update CLI to POST to Worker
- [ ] Update frontend to use API client
- [ ] Remove sql.js dependency from frontend
- [ ] Add mprocs configuration
- [ ] Test complete local flow
- [ ] Deploy Worker to production
- [ ] Update CI/CD workflow
- [ ] Test production flow
- [ ] Monitor and verify

---

## 15. API Endpoint Reference

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/runs` | List benchmark runs |
| GET | `/api/runs/:runId` | Get run details |
| GET | `/api/runs/:runId/evaluations` | Get run evaluations |
| GET | `/api/runs/:runId/telemetry` | Get run telemetry |
| GET | `/api/batches` | List batches |
| GET | `/api/batches/:batchId` | Get batch details |
| GET | `/api/batches/:batchId/analytics` | Get batch analytics |
| GET | `/api/batches/compare?ids=x,y` | Compare batches |
| GET | `/api/stats` | Global statistics |
| GET | `/api/stats/agents` | Agent performance |
| GET | `/api/stats/suites/:suite` | Suite statistics |
| GET | `/api/stats/scenarios/:suite/:scenario` | Scenario statistics |
| GET | `/api/stats/models` | Model performance |
| GET | `/api/stats/evaluators/:name/trends` | Evaluator trends |

### Protected Endpoints (Requires Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/results` | Submit benchmark result |
| POST | `/api/results/batch` | Submit batch result |

---

## 16. Cost Estimates

### Cloudflare Free Tier
- **Workers**: 100,000 requests/day
- **D1**: 5 GB storage, 5 million rows read/day
- **Pages**: Unlimited static requests (if hosting frontend there)

For your use case (benchmarks dashboard), this should be **completely free** unless you have extremely high traffic.

---

## 17. Quick Start Guide

### First-Time Setup

```bash
# 1. Install mprocs
npm install -g mprocs
# OR: cargo install mprocs

# 2. Install dependencies
pnpm install

# 3. Setup local D1 database
cd worker
pnpm install
wrangler d1 migrations apply ze-benchmarks --local

# 4. Start all services
cd ..
pnpm dev
```

### Running Benchmarks Locally

```bash
# In a new terminal
export ZE_BENCHMARKS_WORKER_URL=http://localhost:8787
export ZE_BENCHMARKS_API_KEY=dev-local-key
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic

# View results at http://localhost:3000
```

### Production Deployment

```bash
# 1. Create remote D1
cd worker
wrangler d1 create ze-benchmarks
# Copy database_id to wrangler.toml

# 2. Apply migrations
wrangler d1 migrations apply ze-benchmarks --remote

# 3. Set secrets
wrangler secret put API_SECRET_KEY

# 4. Deploy
pnpm deploy

# 5. Update GitHub secrets:
# - WORKER_URL: Your Worker URL
# - BENCHMARK_API_KEY: Same as API_SECRET_KEY
```

---

## Summary

This implementation provides:
- ✅ **Unified architecture** - Same code for local and production
- ✅ **One-command start** - `pnpm dev` launches everything
- ✅ **Real-time updates** - CLI → Worker → Frontend flow
- ✅ **Zero cost** - Cloudflare free tier handles it all
- ✅ **Production ready** - Edge deployment, global CDN
- ✅ **Easy testing** - Test the real flow locally before deploying
