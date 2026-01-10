import { WorkerClient } from '@ze/worker-client';
import type {
  BatchStatistics,
  DetailedRunStatistics,
  EvaluationResult as WorkerEvaluation,
  RunTelemetry as WorkerTelemetry
} from '@ze/worker-client';
import type { BenchmarkRun } from './types.js';
import { logger } from '@ze/logger';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const log = logger.benchmarkLoader;

/**
 * Load benchmark runs from local cache (helper function)
 */
function loadFromCache(batchId: string): BenchmarkRun[] | null {
  try {
    // Look for cache file in current working directory
    const cachePath = join(process.cwd(), '.benchmark-cache', `${batchId}.json`);

    if (!existsSync(cachePath)) {
      log.debug(`No cache file found at: ${cachePath}`);
      return null;
    }

    log.debug(`Found cache file: ${cachePath}`);
    const content = readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(content);

    if (!cache.runs || cache.runs.length === 0) {
      log.debug('Cache file exists but contains no runs');
      return null;
    }

    // Transform cached runs to BenchmarkRun format
    const runs: BenchmarkRun[] = cache.runs.map((run: any) => ({
      run_id: run.runId,
      run_date: run.completedAt || run.startedAt,
      batch_id: run.batchId,
      suite: run.suite,
      scenario: run.scenario,
      tier: run.tier,
      agent: run.agent,
      model: run.model || '',
      specialist_enabled: run.specialistEnabled || false,
      overall_score: run.totalScore || 0,
      telemetry: run.telemetry ? {
        duration_ms: run.telemetry.durationMs || 0,
        token_usage: {
          prompt_tokens: run.telemetry.tokensIn || 0,
          completion_tokens: run.telemetry.tokensOut || 0,
          total_tokens: (run.telemetry.tokensIn || 0) + (run.telemetry.tokensOut || 0)
        }
      } : undefined
    }));

    log.info(`📁 Loaded ${runs.length} run(s) from cache file`);
    log.debug(`   Cache created: ${cache.created}`);
    log.debug(`   Cache updated: ${cache.updated}`);

    return runs;
  } catch (error) {
    log.warn(`Failed to load from cache: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Load all benchmark runs from a batch using Worker API
 *
 * @param batchId - The batch ID from ze-benchmarks
 * @param workerUrl - Optional Worker API URL (defaults to env var)
 * @returns Array of benchmark runs or null if failed
 */
export async function loadBenchmarkBatch(
  batchId: string,
  workerUrl?: string
): Promise<BenchmarkRun[] | null> {
  try {
    // STEP 1: Check for cached benchmarks first
    const cached = loadFromCache(batchId);
    if (cached) {
      log.info(`✓ Loaded ${cached.length} benchmark run(s) from cache`);
      return cached;
    }

    // STEP 2: Try Worker API (existing logic)
    log.debug('No cache found, trying Worker API...');

    // Initialize Worker API client
    const client = new WorkerClient({
      workerUrl: workerUrl || process.env.ZE_BENCHMARKS_WORKER_URL,
      apiKey: process.env.ZE_BENCHMARKS_API_KEY
    });

    // Check worker connectivity
    const isHealthy = await client.healthCheck();
    if (!isHealthy) {
      log.warn('⚠️  Worker API is not accessible');
      log.warn(`   URL: ${workerUrl || process.env.ZE_BENCHMARKS_WORKER_URL || 'http://localhost:8787'}`);
      log.warn('   Make sure the worker is running: cd apps/worker && pnpm dev');
      return null;
    }

    // Fetch batch with all runs
    log.debug(`Fetching batch details for: ${batchId}`);
    const batch: BatchStatistics = await client.getBatchDetails(batchId);

    log.debug(`Batch found: ${batch.batchId}`);
    log.debug(`Total runs in batch: ${batch.totalRuns || 0}`);
    log.debug(`Runs array length: ${batch.runs?.length || 0}`);

    if (!batch.runs || batch.runs.length === 0) {
      log.warn(`⚠️  No runs found for batch: ${batchId}`);
      log.warn(`   Batch exists but has no associated runs`);
      log.warn(`   This may indicate:`);
      log.warn(`   - Batch is still processing`);
      log.warn(`   - Runs failed to submit`);
      log.warn(`   - Database query issue`);
      log.warn('   Continuing without benchmark results...');
      return null;
    }

    // Filter for completed runs only
    const completedRuns = batch.runs.filter(run => run.status === 'completed');

    if (completedRuns.length === 0) {
      log.warn(`⚠️  No completed runs found for batch: ${batchId}`);
      log.warn('   Continuing without benchmark results...');
      return null;
    }

    // Fetch detailed run info including evaluations and telemetry
    const detailedRuns = await Promise.all(
      completedRuns.map(async (run) => {
        try {
          return await client.getRunDetails(run.runId);
        } catch (error) {
          log.warn(`⚠️  Failed to fetch details for run ${run.runId}: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        }
      })
    );

    // Filter out failed fetches and map to specialist-mint format
    const runs: BenchmarkRun[] = detailedRuns
      .filter((run): run is DetailedRunStatistics => run !== null)
      .map(mapWorkerRunToMintRun);

    log.debug(`✓ Loaded ${runs.length} benchmark run(s) from batch ${batchId}`);
    return runs;

  } catch (error) {
    log.warn(`⚠️  Failed to load benchmark batch: ${error instanceof Error ? error.message : String(error)}`);
    log.warn('   Continuing without benchmark results...');
    return null;
  }
}


/**
 * Map Worker API run format to specialist-mint format
 */
function mapWorkerRunToMintRun(workerRun: DetailedRunStatistics): BenchmarkRun {
  // Convert telemetry to specialist-mint format
  let telemetry: BenchmarkRun['telemetry'] = undefined;
  if (workerRun.telemetry) {
    telemetry = {
      duration_ms: workerRun.telemetry.durationMs || 0,
      token_usage: {
        prompt_tokens: workerRun.telemetry.tokensIn || 0,
        completion_tokens: workerRun.telemetry.tokensOut || 0,
        total_tokens: (workerRun.telemetry.tokensIn || 0) + (workerRun.telemetry.tokensOut || 0)
      }
    };
  }

  return {
    run_id: workerRun.runId,
    run_date: workerRun.completedAt || workerRun.startedAt,
    batch_id: workerRun.batchId || '',
    suite: workerRun.suite,
    scenario: workerRun.scenario,
    tier: workerRun.tier,
    agent: workerRun.agent,
    model: workerRun.model || '',
    specialist_enabled: workerRun.specialistEnabled || false,
    overall_score: workerRun.totalScore || 0,
    telemetry
  };
}
