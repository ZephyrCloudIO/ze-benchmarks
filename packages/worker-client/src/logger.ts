import { WorkerClient, getWorkerClient } from './client';
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
    console.log(`[BenchmarkLogger] Run started: ${runId}`);

    return runId;
  }

  /**
   * Fail a benchmark run (backwards compatibility)
   */
  async failRun(error: string, category?: string): Promise<void> {
    // Old signature for backwards compatibility
    // Just log it - we don't have enough context to submit to API
    console.log(`[BenchmarkLogger] Run failed: ${error} (category: ${category || 'unknown'})`);
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
      metadata?: Record<string, any>;
      evaluations?: EvaluationResult[];
      telemetry?: RunTelemetry;
    } | number,
    weightedScore?: number,
    metadata?: Record<string, any>,
    isSuccessful?: boolean,
    successMetric?: number
  ): Promise<void> {
    let payload: SubmitRunPayload;

    // Check if using old signature: completeRun(score, weightedScore, metadata, isSuccessful, successMetric)
    if (typeof dataOrScore === 'number') {
      // Old signature - use stored run context
      if (!this.currentRun) {
        throw new Error('[BenchmarkLogger] No active run. Call startRun() first.');
      }

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
        metadata: metadata,
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
        metadata: dataOrScore.metadata,
        evaluations: dataOrScore.evaluations,
        telemetry: dataOrScore.telemetry,
      };
    }

    await this.client.submitRun(payload);
    console.log(`[BenchmarkLogger] Run completed: ${payload.runId}`);

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
    console.log(`[BenchmarkLogger] Batch upserted: ${data.batchId}`);
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
    console.log('[BenchmarkLogger] getBatchComparison: Not yet implemented for worker-based system');
    return [];
  }

  /**
   * Start a new batch
   */
  async startBatch(): Promise<string> {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create the batch in the database immediately
    await this.upsertBatch({
      batchId,
      createdAt: Date.now(),
      totalRuns: 0,
      successfulRuns: 0,
    });

    console.log(`[BenchmarkLogger] Batch started: ${batchId}`);
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
    console.log(`[BenchmarkLogger] Batch completed: ${batchId}`);
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
   * Clear database (no-op for worker-based system)
   */
  async clearDatabase(): Promise<void> {
    console.log('[BenchmarkLogger] clearDatabase: Not supported for worker-based system');
  }

  /**
   * Log telemetry data
   */
  async logTelemetry(runId: string, telemetry: RunTelemetry): Promise<void> {
    console.log(`[BenchmarkLogger] Telemetry logged for run: ${runId}`);
    // Telemetry is sent as part of completeRun
  }

  /**
   * Log evaluation result
   */
  async logEvaluation(runId: string, evaluation: EvaluationResult): Promise<void> {
    console.log(`[BenchmarkLogger] Evaluation logged for run: ${runId}`);
    // Evaluations are sent as part of completeRun
  }

  /**
   * Close connection (no-op for HTTP client)
   */
  close(): void {
    console.log('[BenchmarkLogger] Connection closed');
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
