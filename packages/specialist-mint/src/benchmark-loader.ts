import { WorkerClient } from '@ze/worker-client';
import type {
  BatchStatistics,
  DetailedRunStatistics,
  EvaluationResult as WorkerEvaluation,
  RunTelemetry as WorkerTelemetry
} from '@ze/worker-client';
import type { BenchmarkRun } from './types.js';
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
  workerUrl?: string,
  options?: { maxRetries?: number; retryDelayMs?: number }
): Promise<BenchmarkRun[] | null> {
  const maxRetries = options?.maxRetries ?? 3;
  const retryDelayMs = options?.retryDelayMs ?? 1000;

  try {
    log.debug(`Loading benchmark batch from Worker API: ${batchId}`);

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

    // Fetch batch with all runs (with retry for eventual consistency)
    let batch: BatchStatistics | null = null;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      log.debug(`Fetching batch details for: ${batchId} (attempt ${attempt}/${maxRetries})`);
      batch = await client.getBatchDetails(batchId);

      log.debug(`Batch found: ${batch.batchId}`);
      log.debug(`Total runs in batch: ${batch.totalRuns || 0}`);
      log.debug(`Runs array length: ${batch.runs?.length || 0}`);

      // If we found runs, break out of retry loop
      if (batch.runs && batch.runs.length > 0) {
        break;
      }

      // If no runs found and we have retries left, wait and retry
      if (attempt < maxRetries) {
        log.debug(`No runs found yet, waiting ${retryDelayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }

    if (!batch || !batch.runs || batch.runs.length === 0) {
      log.warn(`⚠️  No runs found for batch: ${batchId} after ${maxRetries} attempts`);
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

  // Map evaluations from Worker API to specialist-mint format
  const evaluations: BenchmarkRun['evaluations'] = {};

  if (workerRun.evaluations && workerRun.evaluations.length > 0) {
    for (const evaluation of workerRun.evaluations) {
      try {
        // Parse the JSON details string
        const details = evaluation.details ? JSON.parse(evaluation.details) : null;

        // Map Heuristic Checks
        if (evaluation.evaluatorName === 'HeuristicChecksEvaluator' && details) {
          evaluations.heuristic_checks = {
            score: evaluation.score,
            max_score: evaluation.maxScore,
            passed: details.passed || 0,
            total: details.total || 0,
            checks: (details.checks || []).map((check: any) => ({
              name: check.name,
              passed: check.passed,
              weight: check.weight,
              description: check.description,
              error: check.error
            }))
          };
        }

        // Map LLM Judge
        if (evaluation.evaluatorName === 'LLMJudgeEvaluator' && details) {
          evaluations.llm_judge = {
            score: evaluation.score,
            max_score: evaluation.maxScore,
            normalized_score: details.normalized_score || evaluation.score,
            categories: (details.scores || []).map((cat: any) => ({
              category: cat.category,
              score: cat.score,
              reasoning: cat.reasoning
            })),
            overall_assessment: details.overall_assessment,
            input_tokens: details.input_tokens
          };
        }
      } catch (error) {
        log.warn(`Failed to parse evaluation details for ${evaluation.evaluatorName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return {
    run_id: workerRun.runId,
    run_date: workerRun.completedAt || workerRun.startedAt,
    batch_id: workerRun.batchId || '',
    suite: workerRun.suite,
    scenario: workerRun.scenario,
    tier: workerRun.tier,
    agent: workerRun.agent,
    model: workerRun.model || 'unknown',
    specialist_enabled: workerRun.specialistEnabled || false,
    overall_score: workerRun.totalScore ?? 0,
    evaluations: Object.keys(evaluations).length > 0 ? evaluations : undefined,
    telemetry
  };
}
