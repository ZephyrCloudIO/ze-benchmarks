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
   */
  async startRun(data: {
    runId: string;
    batchId?: string;
    suite: string;
    scenario: string;
    tier: string;
    agent: string;
    model?: string;
    startedAt: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    // Submit initial run with 'running' status
    // Note: Worker API doesn't support 'running' status yet, so we'll just store locally for now
    // When run completes, we'll submit with 'completed' or 'failed'
    console.log(`[BenchmarkLogger] Run started: ${data.runId}`);
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
   */
  async completeRun(data: {
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
  }): Promise<void> {
    const payload: SubmitRunPayload = {
      runId: data.runId,
      batchId: data.batchId,
      suite: data.suite,
      scenario: data.scenario,
      tier: data.tier,
      agent: data.agent,
      model: data.model,
      status: data.status,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      totalScore: data.totalScore,
      weightedScore: data.weightedScore,
      isSuccessful: data.isSuccessful,
      successMetric: data.successMetric,
      metadata: data.metadata,
      evaluations: data.evaluations,
      telemetry: data.telemetry,
    };

    await this.client.submitRun(payload);
    console.log(`[BenchmarkLogger] Run completed: ${data.runId}`);
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
  async getSuiteStats(): Promise<SuiteStatistics[]> {
    // This would need a new API endpoint
    // For now, return empty array
    return [];
  }

  /**
   * Get scenario-specific statistics
   */
  async getScenarioStats(suite: string): Promise<ScenarioStatistics[]> {
    // This would need a new API endpoint
    // For now, return empty array
    return [];
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
