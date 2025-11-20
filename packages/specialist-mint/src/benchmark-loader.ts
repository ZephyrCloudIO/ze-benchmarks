import { WorkerClient } from '@ze/worker-client';
import type {
  BatchStatistics,
  DetailedRunStatistics,
  EvaluationResult as WorkerEvaluation,
  RunTelemetry as WorkerTelemetry
} from '@ze/worker-client';
import type { BenchmarkRun, BenchmarkResults } from './types.js';
import { logger } from '@ze/logger';

const log = logger.benchmarkLoader;

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
    const batch: BatchStatistics = await client.getBatchDetails(batchId);

    if (!batch.runs || batch.runs.length === 0) {
      log.warn(`⚠️  No runs found for batch: ${batchId}`);
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
 * Load the most recent successful benchmark run
 *
 * @deprecated Use loadBenchmarkBatch instead for batch-based loading
 * @param workerUrl - Optional Worker API URL (defaults to env var)
 * @returns Benchmark results or null if failed
 */
export async function loadBenchmarkResults(workerUrl?: string): Promise<BenchmarkResults | null> {
  try {
    const client = new WorkerClient({
      workerUrl: workerUrl || process.env.ZE_BENCHMARKS_WORKER_URL,
      apiKey: process.env.ZE_BENCHMARKS_API_KEY
    });

    // Check worker connectivity
    const isHealthy = await client.healthCheck();
    if (!isHealthy) {
      log.warn('⚠️  Worker API is not accessible');
      return null;
    }

    // Get all runs and find the most recent successful one
    const runs = await client.listRuns({ limit: 100 });
    const successfulRun = runs.find(run =>
      run.status === 'completed' && run.isSuccessful
    );

    if (!successfulRun) {
      log.warn('⚠️  No successful benchmark runs found');
      log.warn('   Continuing without benchmark results...');
      return null;
    }

    // Fetch detailed information
    const detailedRun = await client.getRunDetails(successfulRun.runId);

    // Map to specialist-mint format
    const mintRun = mapWorkerRunToMintRun(detailedRun);

    const result: BenchmarkResults = {
      run_id: mintRun.run_id,
      run_date: mintRun.run_date,
      suite: mintRun.suite,
      scenario: mintRun.scenario,
      tier: mintRun.tier,
      agent: mintRun.agent,
      model: mintRun.model,
      overall_score: mintRun.overall_score,
      evaluations: mintRun.evaluations
    };

    log.debug(`✓ Loaded benchmark results from Worker API`);
    log.debug(`  Run ID: ${result.run_id}`);
    log.debug(`  Suite: ${result.suite}`);
    log.debug(`  Scenario: ${result.scenario}`);
    log.debug(`  Overall Score: ${result.overall_score.toFixed(2)}`);

    return result;
  } catch (error) {
    log.warn(`⚠️  Failed to load benchmark results: ${error instanceof Error ? error.message : String(error)}`);
    log.warn('   Continuing without benchmark results...');
    return null;
  }
}

/**
 * Map Worker API run format to specialist-mint format
 */
function mapWorkerRunToMintRun(workerRun: DetailedRunStatistics): BenchmarkRun {
  // Convert Worker API evaluations to specialist-mint format
  const evaluations: Record<string, { score: number; passed: boolean; error?: string }> = {};

  if (workerRun.evaluations && workerRun.evaluations.length > 0) {
    for (const evaluation of workerRun.evaluations) {
      const normalizedScore = evaluation.maxScore > 0 ? evaluation.score / evaluation.maxScore : 0;
      evaluations[evaluation.evaluatorName] = {
        score: normalizedScore,
        passed: evaluation.score >= evaluation.maxScore,
        error: evaluation.details
      };
    }
  }

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
    evaluations,
    telemetry
  };
}
