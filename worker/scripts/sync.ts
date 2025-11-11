#!/usr/bin/env tsx
/**
 * Manual sync script: Local SQLite → Cloudflare D1 via Worker API
 * 
 * This script reads data from the local SQLite database and syncs it to
 * Cloudflare D1 by posting to the Worker API endpoints.
 * 
 * Usage:
 *   pnpm sync-to-d1 [options]
 * 
 * Options:
 *   --dry-run    Preview what would be synced without actually syncing
 *   --limit N    Only sync first N records per table
 *   --force       Skip duplicate checks and force insert
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync } from 'fs';

// Configuration
const LOCAL_DB_PATH = join(process.cwd(), '..', 'benchmark-report', 'public', 'benchmarks.db');
const WORKER_URL = process.env.ZE_BENCHMARKS_WORKER_URL || 'http://localhost:8787';
const API_KEY = process.env.ZE_BENCHMARKS_API_KEY || 'dev-local-key';

interface SyncOptions {
  dryRun: boolean;
  limit?: number;
  force: boolean;
}

interface SyncStats {
  batches: { total: number; synced: number; skipped: number; errors: number };
  runs: { total: number; synced: number; skipped: number; errors: number };
  evaluations: { total: number; synced: number; skipped: number; errors: number };
  telemetry: { total: number; synced: number; skipped: number; errors: number };
}

/**
 * Transform local SQLite timestamp to ISO string or keep as number
 */
function transformTimestamp(value: any, isInteger: boolean = false): string | number | undefined {
  if (value === null || value === undefined) return undefined;
  
  if (isInteger) {
    // For createdAt/completedAt in batch_runs (INTEGER milliseconds)
    return typeof value === 'number' ? value : parseInt(value, 10);
  } else {
    // For started_at/completed_at in benchmark_runs (DATETIME string)
    return typeof value === 'string' ? value : new Date(value).toISOString();
  }
}

/**
 * Transform boolean (0/1) to boolean
 */
function transformBoolean(value: any): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  return value === 1 || value === true || value === '1';
}

/**
 * Check if batch exists in D1 by querying Worker API
 */
async function batchExists(batchId: string): Promise<boolean> {
  try {
    const response = await fetch(`${WORKER_URL}/api/batches/${batchId}`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if run exists in D1 by querying Worker API
 */
async function runExists(runId: string): Promise<boolean> {
  try {
    const response = await fetch(`${WORKER_URL}/api/runs/${runId}`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if D1 database schema is initialized by testing a simple query
 */
async function checkDatabaseSchema(): Promise<boolean> {
  try {
    // Try to fetch stats which requires all tables to exist
    const response = await fetch(`${WORKER_URL}/api/stats`);
    if (!response.ok) {
      // If stats endpoint fails, check if it's a schema issue
      const text = await response.text();
      if (text.includes('no such table') || text.includes('SQLITE_ERROR')) {
        return false;
      }
      return false;
    }
    return true;
  } catch (error: any) {
    // If we can't connect, assume schema check passed (connection issue is handled elsewhere)
    return true;
  }
}

/**
 * Sync batch_runs table
 */
async function syncBatches(localDb: Database.Database, options: SyncOptions, stats: SyncStats): Promise<void> {
  console.log('\nSyncing batch_runs...');
  
  let query = 'SELECT * FROM batch_runs ORDER BY createdAt DESC';
  if (options.limit) {
    query += ` LIMIT ${options.limit}`;
  }
  
  const batches = localDb.prepare(query).all() as any[];
  stats.batches.total = batches.length;
  
  console.log(`   Found ${batches.length} batches`);
  
  for (const batch of batches) {
    try {
      // Check if already exists
      if (!options.force && !options.dryRun) {
        const exists = await batchExists(batch.batchId);
        if (exists) {
          console.log(`   Skipping batch ${batch.batchId} (already exists)`);
          stats.batches.skipped++;
          continue;
        }
      }
      
      if (options.dryRun) {
        console.log(`   Would sync batch: ${batch.batchId}`);
        stats.batches.synced++;
        continue;
      }
      
      // Transform data to match Worker API format
      const createdAt = transformTimestamp(batch.createdAt, true);
      if (!createdAt || typeof createdAt !== 'number') {
        console.log(`   Skipping batch ${batch.batchId} (invalid createdAt)`);
        stats.batches.skipped++;
        continue;
      }
      
      const payload = {
        batchId: batch.batchId,
        createdAt: createdAt,
        completedAt: batch.completedAt ? transformTimestamp(batch.completedAt, true) as number : undefined,
        totalRuns: batch.totalRuns ?? 0,
        successfulRuns: batch.successfulRuns ?? 0,
        avgScore: batch.avgScore ?? undefined,
        avgWeightedScore: batch.avgWeightedScore ?? undefined,
        metadata: batch.metadata ? (typeof batch.metadata === 'string' ? JSON.parse(batch.metadata) : batch.metadata) : undefined
      };
      
      // POST to Worker API
      const response = await fetch(`${WORKER_URL}/api/results/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }
      
      console.log(`   Synced batch: ${batch.batchId}`);
      stats.batches.synced++;
    } catch (error: any) {
      console.error(`   Error syncing batch ${batch.batchId}: ${error.message}`);
      stats.batches.errors++;
    }
  }
}

/**
 * Sync benchmark_runs table
 */
async function syncRuns(localDb: Database.Database, options: SyncOptions, stats: SyncStats): Promise<void> {
  console.log('\nSyncing benchmark_runs...');
  
  let query = 'SELECT * FROM benchmark_runs ORDER BY started_at DESC';
  if (options.limit) {
    query += ` LIMIT ${options.limit}`;
  }
  
  const runs = localDb.prepare(query).all() as any[];
  stats.runs.total = runs.length;
  
  console.log(`   Found ${runs.length} runs`);
  
  // Get evaluations and telemetry for each run
  for (const run of runs) {
    try {
      // Check if already exists
      if (!options.force && !options.dryRun) {
        const exists = await runExists(run.run_id);
        if (exists) {
          console.log(`   Skipping run ${run.run_id} (already exists)`);
          stats.runs.skipped++;
          continue;
        }
      }
      
      if (options.dryRun) {
        console.log(`   Would sync run: ${run.run_id}`);
        stats.runs.synced++;
        continue;
      }
      
      // Get evaluations for this run
      const evaluations = localDb.prepare(`
        SELECT evaluator_name, score, max_score, details
        FROM evaluation_results
        WHERE run_id = ?
      `).all(run.run_id) as any[];
      
      // Get telemetry for this run
      const telemetry = localDb.prepare(`
        SELECT tool_calls, tokens_in, tokens_out, cost_usd, duration_ms, workspace_dir
        FROM run_telemetry
        WHERE run_id = ?
        LIMIT 1
      `).get(run.run_id) as any;
      
      // Skip runs with 'running' status (they're not complete)
      if (run.status === 'running') {
        console.log(`   Skipping run ${run.run_id} (status: running)`);
        stats.runs.skipped++;
        continue;
      }
      
      // Ensure startedAt is a valid string
      const startedAt = transformTimestamp(run.started_at, false);
      if (!startedAt || typeof startedAt !== 'string') {
        console.log(`   Skipping run ${run.run_id} (invalid started_at)`);
        stats.runs.skipped++;
        continue;
      }
      
      // Transform data to match Worker API format
      const payload = {
        runId: run.run_id,
        batchId: run.batchId || undefined,
        suite: run.suite,
        scenario: run.scenario,
        tier: run.tier,
        agent: run.agent,
        model: run.model || undefined,
        status: run.status as 'completed' | 'failed', // Type assertion for API
        startedAt: startedAt,
        completedAt: run.completed_at ? transformTimestamp(run.completed_at, false) as string : run.started_at, // Fallback to started_at if no completed_at
        totalScore: run.total_score ?? undefined,
        weightedScore: run.weighted_score ?? undefined,
        isSuccessful: transformBoolean(run.is_successful) ?? false,
        successMetric: run.success_metric ?? undefined,
        metadata: run.metadata ? (typeof run.metadata === 'string' ? JSON.parse(run.metadata) : run.metadata) : undefined,
        evaluations: evaluations.map(e => ({
          evaluatorName: e.evaluator_name,
          score: e.score,
          maxScore: e.max_score,
          details: e.details || undefined
        })),
        telemetry: telemetry ? {
          toolCalls: telemetry.tool_calls ?? undefined,
          tokensIn: telemetry.tokens_in ?? undefined,
          tokensOut: telemetry.tokens_out ?? undefined,
          costUsd: telemetry.cost_usd ?? undefined,
          durationMs: telemetry.duration_ms ?? undefined,
          workspaceDir: telemetry.workspace_dir || undefined
        } : undefined
      };
      
      // POST to Worker API
      const response = await fetch(`${WORKER_URL}/api/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }
      
      const result = await response.json();
      console.log(`   Synced run: ${run.run_id}`);
      stats.runs.synced++;
      
      // Track evaluations and telemetry
      if (evaluations.length > 0) {
        stats.evaluations.synced += evaluations.length;
      }
      if (telemetry) {
        stats.telemetry.synced++;
      }
    } catch (error: any) {
      console.error(`   Error syncing run ${run.run_id}: ${error.message}`);
      stats.runs.errors++;
    }
  }
}

/**
 * Main sync function
 */
async function syncToD1(options: SyncOptions): Promise<void> {
  console.log('Starting sync: Local SQLite → Cloudflare D1\n');
  console.log(`   Local DB: ${LOCAL_DB_PATH}`);
  console.log(`   Worker URL: ${WORKER_URL}`);
  
  // Detect if using local or remote
  const isLocal = WORKER_URL.includes('localhost') || WORKER_URL.includes('127.0.0.1');
  if (isLocal) {
    console.log(`   ⚠️  Target: LOCAL Worker (localhost:8787) → Local D1`);
    console.log(`   💡 To sync to REMOTE D1, set ZE_BENCHMARKS_WORKER_URL to your production Worker URL`);
  } else {
    console.log(`   ✅ Target: REMOTE Worker (${WORKER_URL}) → Remote D1`);
  }
  
  console.log(`   Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
  if (options.limit) {
    console.log(`   Limit: ${options.limit} records per table`);
  }
  console.log('');
  
  // Check if local database exists
  if (!existsSync(LOCAL_DB_PATH)) {
    console.error(`Local database not found: ${LOCAL_DB_PATH}`);
    process.exit(1);
  }
  
  // Check Worker API connectivity
  if (!options.dryRun) {
    try {
      const response = await fetch(`${WORKER_URL}/health`);
      if (!response.ok) {
        throw new Error(`Worker API returned ${response.status}`);
      }
      console.log('Worker API is accessible');
      
      // Check if database schema is initialized
      const schemaExists = await checkDatabaseSchema();
      if (!schemaExists) {
        console.error('\nDatabase schema not initialized. Please run migrations first:');
        console.error('   cd worker && pnpm db:push:local  # for local D1');
        console.error('   cd worker && pnpm db:push:remote # for remote D1');
        console.error('\nOr ensure Wrangler auto-applies migrations when the Worker starts.');
        process.exit(1);
      }
      console.log('Database schema verified\n');
    } catch (error: any) {
      console.error(`Cannot connect to Worker API: ${error.message}`);
      console.log(`   Make sure the Worker is running: cd worker && pnpm dev`);
      process.exit(1);
    }
  }
  
  // Open local database
  const localDb = new Database(LOCAL_DB_PATH, { readonly: true });
  
  const stats: SyncStats = {
    batches: { total: 0, synced: 0, skipped: 0, errors: 0 },
    runs: { total: 0, synced: 0, skipped: 0, errors: 0 },
    evaluations: { total: 0, synced: 0, skipped: 0, errors: 0 },
    telemetry: { total: 0, synced: 0, skipped: 0, errors: 0 }
  };
  
  try {
    // Sync in order: batches first, then runs (which reference batches)
    await syncBatches(localDb, options, stats);
    await syncRuns(localDb, options, stats);
    
    // Print summary
    console.log('\nSync Summary:');
    console.log(`   Batches: ${stats.batches.synced}/${stats.batches.total} synced, ${stats.batches.skipped} skipped, ${stats.batches.errors} errors`);
    console.log(`   Runs: ${stats.runs.synced}/${stats.runs.total} synced, ${stats.runs.skipped} skipped, ${stats.runs.errors} errors`);
    console.log(`   Evaluations: ${stats.evaluations.synced} synced`);
    console.log(`   Telemetry: ${stats.telemetry.synced} synced`);
    
    if (options.dryRun) {
      console.log('\nThis was a dry run. No data was actually synced.');
      console.log('   Run without --dry-run to perform the actual sync.');
    } else {
      console.log('\nSync complete!');
    }
  } finally {
    localDb.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: SyncOptions = {
  dryRun: args.includes('--dry-run'),
  limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : undefined,
  force: args.includes('--force')
};

// Run sync
syncToD1(options).catch(error => {
  console.error('Sync failed:', error);
  process.exit(1);
});

