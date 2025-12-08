import { WorkerClient, getWorkerClient } from './client';
import { logger } from '@ze/logger'
import type {
  SubmitRunPayload,
  SubmitBatchPayload,
  BenchmarkRun,
  EvaluationResult,
  RunTelemetry,
  BatchRun,
  RunStatistics,
  SuiteStatistics,
  ScenarioStatistics,
  DetailedRunStatistics,
  BatchStatistics,
} from './types';

/**
 * Drop-in replacement for BenchmarkLogger that uses Worker API instead of local SQLite
 */
export class BenchmarkLogger {
  private static instance: BenchmarkLogger | null = null;
  private static log = logger.workerClient;
  private client: WorkerClient;
  private currentRun: {
    runId: string;
    batchId?: string;
    suite: string;
    scenario: string;
    tier: string;
    agent: string;
    model?: string;
    startedAt: string;
  } | null = null;

  private constructor() {
    this.client = getWorkerClient();
  }

  static getInstance(): BenchmarkLogger {
    if (!BenchmarkLogger.instance) {
      BenchmarkLogger.instance = new BenchmarkLogger();
    }
    return BenchmarkLogger.instance;
  }

  /**
   * Check if worker is accessible
   */
  async checkConnection(): Promise<boolean> {
    return this.client.healthCheck();
  }

  /**
   * Start a new benchmark run
   * Supports both old and new signatures for backwards compatibility
   */
  startRun(
    suiteOrData: string | {
      runId: string;
      batchId?: string;
      suite: string;
      scenario: string;
      tier: string;
      agent: string;
      model?: string;
      startedAt: string;
      metadata?: Record<string, any>;
    },
    scenario?: string,
    tier?: string,
    agent?: string,
    model?: string,
    batchId?: string
  ): string {
    let runId: string;
    let runData: {
      runId: string;
      batchId?: string;
      suite: string;
      scenario: string;
      tier: string;
      agent: string;
      model?: string;
      startedAt: string;
    };

    // Check if using old signature: startRun(suite, scenario, tier, agent, model, batchId)
    if (typeof suiteOrData === 'string') {
      // Old signature - generate runId and create run data
      runId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      runData = {
        runId,
        batchId,
        suite: suiteOrData,
        scenario: scenario!,
        tier: tier!,
        agent: agent!,
        model,
        startedAt: new Date().toISOString(),
      };
    } else {
      // New signature - use provided data object
      runId = suiteOrData.runId;
      runData = suiteOrData;
    }

    // Store run context for backwards-compatible methods
    this.currentRun = runData;
    BenchmarkLogger.log.info(`Run started: ${runId}`);

    return runId;
  }

  /**
   * Fail a benchmark run (backwards compatibility)
   */
  async failRun(error: string, category?: string): Promise<void> {
    // Old signature for backwards compatibility
    // Just log it - we don't have enough context to submit to API
    BenchmarkLogger.log.info(`Run failed: ${error} (category: ${category || 'unknown'})`);
    // In the old system this would mark the current run as failed
    // With the new API-based system, we need full run context which isn't available here
    // Callers should use completeRun with status: 'failed' instead
  }

  /**
   * Complete a benchmark run with results
   * Supports both old and new signatures for backwards compatibility
   */
  async completeRun(
    dataOrScore: {
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
      isSuccessful?: boolean;
      successMetric?: number;
      specialistEnabled?: boolean;
      specialistName?: string;
      specialistVersion?: string;
      metadata?: Record<string, any>;
      evaluations?: EvaluationResult[];
      telemetry?: RunTelemetry;
    } | number,
    weightedScore?: number,
    metadata?: Record<string, any>,
    isSuccessful?: boolean,
    successMetric?: number,
    packageManager?: string,
    testResults?: string
  ): Promise<void> {
    let payload: SubmitRunPayload;

    // Check if using old signature: completeRun(score, weightedScore, metadata, isSuccessful, successMetric, packageManager, testResults)
    if (typeof dataOrScore === 'number') {
      // Old signature - use stored run context
      if (!this.currentRun) {
        throw new Error('[BenchmarkLogger] No active run. Call startRun() first.');
      }

      // Get cached telemetry and evaluations
      const cachedTelemetry = (this.currentRun as any).telemetry;
      const cachedEvaluations = (this.currentRun as any).evaluations;

      // Add packageManager and testResults to metadata if provided
      const enrichedMetadata = {
        ...metadata,
        ...(packageManager && { packageManager }),
        ...(testResults && { testResults }),
      };

      payload = {
        runId: this.currentRun.runId,
        batchId: this.currentRun.batchId,
        suite: this.currentRun.suite,
        scenario: this.currentRun.scenario,
        tier: this.currentRun.tier,
        agent: this.currentRun.agent,
        model: this.currentRun.model,
        status: 'completed',
        startedAt: this.currentRun.startedAt,
        completedAt: new Date().toISOString(),
        totalScore: dataOrScore,
        weightedScore: weightedScore,
        isSuccessful: isSuccessful,
        successMetric: successMetric,
        metadata: enrichedMetadata,
        evaluations: cachedEvaluations,
        telemetry: cachedTelemetry,
      };
    } else {
      // New signature - use provided data object
      payload = {
        runId: dataOrScore.runId,
        batchId: dataOrScore.batchId,
        suite: dataOrScore.suite,
        scenario: dataOrScore.scenario,
        tier: dataOrScore.tier,
        agent: dataOrScore.agent,
        model: dataOrScore.model,
        status: dataOrScore.status,
        startedAt: dataOrScore.startedAt,
        completedAt: dataOrScore.completedAt,
        totalScore: dataOrScore.totalScore,
        weightedScore: dataOrScore.weightedScore,
        isSuccessful: dataOrScore.isSuccessful,
        successMetric: dataOrScore.successMetric,
        specialistEnabled: dataOrScore.specialistEnabled,
        specialistName: dataOrScore.specialistName,
        specialistVersion: dataOrScore.specialistVersion,
        metadata: dataOrScore.metadata,
        evaluations: dataOrScore.evaluations,
        telemetry: dataOrScore.telemetry,
      };
    }

    try {
      await this.client.submitRun(payload);
      const evalCount = payload.evaluations?.length || 0;
      BenchmarkLogger.log.info(`Run completed: ${payload.runId} with ${evalCount} evaluations`);
    } catch (error) {
      BenchmarkLogger.log.warn(`Failed to submit run (worker may not be running): ${error instanceof Error ? error.message : String(error)}`);
      // Continue without worker - result tracking is optional
      // Note: If batch creation failed, startBatch() would have thrown, so batchId should always be valid
    }

    // Clear current run
    this.currentRun = null;
  }

  /**
   * Create or update a batch
   */
  async upsertBatch(data: {
    batchId: string;
    createdAt: number;
    completedAt?: number;
    totalRuns?: number;
    successfulRuns?: number;
    avgScore?: number;
    avgWeightedScore?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const payload: SubmitBatchPayload = {
      batchId: data.batchId,
      createdAt: data.createdAt,
      completedAt: data.completedAt,
      totalRuns: data.totalRuns,
      successfulRuns: data.successfulRuns,
      avgScore: data.avgScore,
      avgWeightedScore: data.avgWeightedScore,
      metadata: data.metadata,
    };

    await this.client.submitBatch(payload);
    BenchmarkLogger.log.info(`Batch upserted: ${data.batchId}`);
  }

  /**
   * Get all runs with optional filters
   */
  async getRuns(filters?: {
    suite?: string;
    scenario?: string;
    agent?: string;
    limit?: number;
  }): Promise<BenchmarkRun[]> {
    return this.client.listRuns(filters);
  }

  /**
   * Get detailed run information
   */
  async getRunDetails(runId: string): Promise<DetailedRunStatistics> {
    return this.client.getRunDetails(runId);
  }

  /**
   * Get all batches
   */
  async getBatches(limit?: number): Promise<BatchRun[]> {
    return this.client.listBatches({ limit });
  }

  /**
   * Get detailed batch information
   */
  async getBatchDetails(batchId: string): Promise<BatchStatistics> {
    return this.client.getBatchDetails(batchId);
  }

  /**
   * Get global statistics
   */
  async getStats(): Promise<RunStatistics> {
    return this.client.getGlobalStats();
  }

  /**
   * Get suite-specific statistics
   */
  async getSuiteStats(suite?: string): Promise<SuiteStatistics | SuiteStatistics[]> {
    // This would need a new API endpoint
    // For now, return empty object/array
    if (suite) {
      return {
        suite,
        total_runs: 0,
        successful_runs: 0,
        avg_score: 0,
        totalRuns: 0,
        successfulRuns: 0,
        avgScore: 0,
        avgWeightedScore: 0,
        avgDuration: 0,
        scenarioBreakdown: []
      };
    }
    return [];
  }

  /**
   * Get scenario-specific statistics
   */
  async getScenarioStats(suite: string, scenario?: string): Promise<ScenarioStatistics | ScenarioStatistics[]> {
    // This would need a new API endpoint
    // For now, return empty object/array
    if (scenario) {
      return {
        scenario,
        total_runs: 0,
        successful_runs: 0,
        avg_score: 0,
        totalRuns: 0,
        successfulRuns: 0,
        avgScore: 0,
        avgWeightedScore: 0,
        minScore: 0,
        maxScore: 0,
        avgDuration: 0,
        agentComparison: []
      };
    }
    return [];
  }

  /**
   * Get detailed run statistics
   */
  async getDetailedRunStats(runId: string): Promise<DetailedRunStatistics> {
    return this.getRunDetails(runId);
  }

  /**
   * Get batch comparison (backwards compatibility stub)
   */
  async getBatchComparison(): Promise<any[]> {
    // This was used for CLI comparison feature
    // Return empty array for now as this needs redesign for API-based system
    BenchmarkLogger.log.info('getBatchComparison: Not yet implemented for worker-based system');
    return [];
  }

  /**
   * Start a new batch
   */
  async startBatch(): Promise<string> {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create the batch in the database immediately
    // If this fails, throw an error to prevent returning a batchId that doesn't exist
    // This ensures foreign key constraint is never violated because batches will always exist before runs reference them
    await this.upsertBatch({
      batchId,
      createdAt: Date.now(),
      totalRuns: 0,
      successfulRuns: 0,
    });

    BenchmarkLogger.log.info(`Batch started: ${batchId}`);
    return batchId;
  }

  /**
   * Complete a batch
   */
  async completeBatch(batchId: string, stats: {
    totalRuns: number;
    successfulRuns: number;
    avgScore?: number;
    avgWeightedScore?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.upsertBatch({
      batchId,
      createdAt: Date.now(),
      completedAt: Date.now(),
      totalRuns: stats.totalRuns,
      successfulRuns: stats.successfulRuns,
      avgScore: stats.avgScore,
      avgWeightedScore: stats.avgWeightedScore,
      metadata: stats.metadata,
    });
    BenchmarkLogger.log.info(`Batch completed: ${batchId}`);
  }

  /**
   * Get successful runs count for a batch
   */
  async getBatchSuccessfulRunsCount(batchId: string): Promise<number> {
    const details = await this.getBatchDetails(batchId);
    return details.successfulRuns || 0;
  }

  /**
   * Get batch score statistics
   */
  async getBatchScoreStats(batchId: string): Promise<{ avgScore?: number; avgWeightedScore?: number }> {
    const details = await this.getBatchDetails(batchId);
    return {
      avgScore: details.avgScore,
      avgWeightedScore: details.avgWeightedScore,
    };
  }

  /**
   * Get batch analytics
   */
  async getBatchAnalytics(batchId: string): Promise<any> {
    const details = await this.getBatchDetails(batchId);
    return {
      suiteBreakdown: details.suiteBreakdown || [],
      agentBreakdown: details.agentBreakdown || [],
      tierBreakdown: details.tierBreakdown || [],
      runs: details.runs || [],
    };
  }

  /**
   * Get failure breakdown
   */
  getFailureBreakdown(analytics: any): any[] {
    return analytics.runs?.filter((r: any) => r.status === 'failed') || [];
  }

  /**
   * Get run history
   */
  async getRunHistory(filters?: {
    suite?: string;
    scenario?: string;
    agent?: string;
    limit?: number;
  }): Promise<BenchmarkRun[]> {
    return this.getRuns(filters);
  }

  /**
   * Get batch history
   */
  async getBatchHistory(limit?: number): Promise<BatchRun[]> {
    return this.getBatches(limit);
  }

  /**
   * Get all batches (alias for getBatchHistory)
   */
  async getAllBatches(limit?: number): Promise<BatchRun[]> {
    return this.getBatches(limit);
  }

  /**
   * Get model performance stats
   */
  async getModelPerformanceStats(runId: string): Promise<any> {
    const details = await this.getRunDetails(runId);
    return details.evaluatorStats || {};
  }

  /**
   * Mark a run as incomplete (backwards compatibility)
   */
  markRunIncomplete(reason?: string, stage?: string): void {
    if (!this.currentRun) {
      BenchmarkLogger.log.warn('No active run to mark incomplete');
      return;
    }

    // Store incomplete status in currentRun metadata
    const metadata = {
      reason: reason || 'Run interrupted',
      stage: stage || 'unknown',
      incomplete: true
    };
    (this.currentRun as any).metadata = {
      ...(this.currentRun as any).metadata,
      ...metadata
    };

    BenchmarkLogger.log.info(`Run marked incomplete: ${this.currentRun.runId}`);
  }

  /**
   * Update the agent name for the current run (backwards compatibility)
   */
  updateAgent(agentName: string, runId?: string): void {
    if (!this.currentRun) {
      BenchmarkLogger.log.warn('No active run to update agent');
      return;
    }

    // Update the agent name in currentRun
    (this.currentRun as any).agent = agentName;

    BenchmarkLogger.log.info(`Agent updated to: ${agentName}`);
  }

  /**
   * Clear database (no-op for worker-based system)
   */
  async clearDatabase(): Promise<void> {
    BenchmarkLogger.log.info('clearDatabase: Not supported for worker-based system');
  }

  /**
   * Log telemetry data
   * Supports both old and new signatures for backwards compatibility
   */
  logTelemetry(
    runIdOrToolCalls?: string | number,
    telemetryOrTokensIn?: RunTelemetry | number,
    tokensOut?: number,
    costUsd?: number,
    durationMs?: number,
    workspaceDir?: string,
    promptSent?: string
  ): void {
    // New signature: logTelemetry(runId: string, telemetry: RunTelemetry)
    if (typeof runIdOrToolCalls === 'string' && typeof telemetryOrTokensIn === 'object') {
      BenchmarkLogger.log.info(`Telemetry logged for run: ${runIdOrToolCalls}`);
      // Telemetry is sent as part of completeRun in the new API-based system
      return;
    }

    // Old signature: logTelemetry(toolCalls?, tokensIn?, tokensOut?, costUsd?, durationMs?, workspaceDir?, promptSent?)
    // Store telemetry to be sent with completeRun
    if (!this.currentRun) {
      BenchmarkLogger.log.warn('No active run for telemetry logging');
      return;
    }

    // Store telemetry in currentRun context
    (this.currentRun as any).telemetry = {
      toolCalls: runIdOrToolCalls as number,
      tokensIn: telemetryOrTokensIn as number,
      tokensOut,
      costUsd,
      durationMs,
      workspaceDir,
      promptSent,
    };

    BenchmarkLogger.log.info(`Telemetry cached for run: ${this.currentRun.runId}`);
  }

  /**
   * Log evaluation result
   * Supports both old and new signatures for backwards compatibility
   */
  logEvaluation(
    runIdOrEvaluatorName: string,
    evaluationOrScore?: EvaluationResult | number,
    maxScore?: number,
    details?: string
  ): void {
    // New signature: logEvaluation(runId: string, evaluation: EvaluationResult)
    if (typeof evaluationOrScore === 'object') {
      BenchmarkLogger.log.info(`Evaluation logged for run: ${runIdOrEvaluatorName}`);
      // Evaluations are sent as part of completeRun in the new API-based system
      return;
    }

    // Old signature: logEvaluation(evaluatorName: string, score: number, maxScore: number, details?: string)
    // Store evaluation to be sent with completeRun
    if (!this.currentRun) {
      BenchmarkLogger.log.warn('No active run for evaluation logging');
      return;
    }

    // Initialize evaluations array if not exists
    if (!(this.currentRun as any).evaluations) {
      (this.currentRun as any).evaluations = [];
    }

    // Store evaluation
    (this.currentRun as any).evaluations.push({
      evaluatorName: runIdOrEvaluatorName,
      score: evaluationOrScore as number,
      maxScore: maxScore!,
      details,
    });

    BenchmarkLogger.log.info(`Evaluation cached for run: ${this.currentRun.runId} (${runIdOrEvaluatorName})`);
  }

  /**
   * Close connection (no-op for HTTP client)
   */
  close(): void {
    BenchmarkLogger.log.info('Connection closed');
  }
}

// Export types for compatibility
export type {
  BenchmarkRun,
  EvaluationResult,
  RunTelemetry,
  BatchRun,
  RunStatistics,
  SuiteStatistics,
  ScenarioStatistics,
  DetailedRunStatistics,
  BatchStatistics,
};
