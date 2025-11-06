import { v4 as uuidv4 } from 'uuid';

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
      console.warn('   or https://your-worker.workers.dev for production');
    } else {
      console.log(`📊 Benchmark results will be submitted to: ${this.workerUrl}`);
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
    if (batchId) {
      console.log(`   Batch ID: ${batchId}`);
    }

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
      this.clearPendingData();
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

      this.clearPendingData();
    } catch (error: any) {
      console.error('❌ Failed to submit results to Worker:', error.message);
      console.error('   Results were not persisted to database');
      throw error;
    }
  }

  private clearPendingData() {
    this.pendingRun = null;
    this.pendingEvaluations = [];
    this.pendingTelemetry = null;
    this.currentRunId = null;
  }

  // Batch operations
  startBatch(): string {
    const batchId = uuidv4();
    this.currentBatchId = batchId;
    console.log(`📦 Started batch: ${batchId}`);
    return batchId;
  }

  async completeBatch(batchId: string, summary: {
    totalRuns: number;
    successfulRuns: number;
    avgScore: number;
    avgWeightedScore: number;
    metadata?: Record<string, any>;
  }) {
    if (!this.workerUrl) {
      console.log('⚠️  Skipping batch submission (no URL configured)');
      return;
    }

    try {
      const payload = {
        batchId,
        createdAt: Date.now(),
        completedAt: Date.now(),
        ...summary
      };

      console.log(`📤 Submitting batch results to ${this.workerUrl}/api/results/batch`);

      const response = await fetch(`${this.workerUrl}/api/results/batch`, {
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
      console.log(`✅ Batch results submitted successfully: ${result.batchId}`);
    } catch (error: any) {
      console.error('❌ Failed to submit batch results:', error.message);
      throw error;
    }
  }

  // Deprecated methods that are no longer needed (queries now go to Worker API)
  getRunHistory() { throw new Error('Use Worker API: GET /api/runs'); }
  getRunDetails() { throw new Error('Use Worker API: GET /api/runs/:runId'); }
  getStats() { throw new Error('Use Worker API: GET /api/stats'); }
  getSuiteStats() { throw new Error('Use Worker API: GET /api/stats/suites/:suite'); }
  getScenarioStats() { throw new Error('Use Worker API: GET /api/stats/scenarios/:suite/:scenario'); }
  getAverageScoresByAgent() { throw new Error('Use Worker API: GET /api/stats/agents'); }
  getBatchHistory() { throw new Error('Use Worker API: GET /api/batches'); }
  getBatchDetails() { throw new Error('Use Worker API: GET /api/batches/:batchId'); }

  close() {
    BenchmarkLogger.instance = null;
  }
}
