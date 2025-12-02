// API Client for interacting with the Cloudflare Worker backend

const API_BASE_URL = import.meta.env.ZE_PUBLIC_API_URL || 'http://localhost:8787';

// Type definitions matching the database schema
export interface BenchmarkRun {
  id: number;
  runId: string;
  batchId?: string;
  suite: string;
  scenario: string;
  tier: string;
  agent: string;
  model?: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  totalScore?: number;
  weightedScore?: number;
  isSuccessful?: boolean;
  successMetric?: number;
  metadata?: string;
}

export interface EvaluationResult {
  id: number;
  runId: string;
  evaluatorName: string;
  score: number;
  maxScore: number;
  details?: string;
  createdAt: string;
}

export interface RunTelemetry {
  id: number;
  runId: string;
  toolCalls?: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  durationMs?: number;
  workspaceDir?: string;
  promptSent?: string;
}

export interface RunDetails {
  run: BenchmarkRun;
  evaluations: EvaluationResult[];
  telemetry: RunTelemetry | null;
}

// Human scoring types
export interface CategoryScore {
  category: string;
  score: number;
  reasoning?: string;
  confidence?: number;
}

export interface HumanScoreSubmission {
  scorerName: string;
  scorerEmail?: string;
  scores: CategoryScore[];
  overallScore?: number;
  timeSpentSeconds?: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface HumanScore extends HumanScoreSubmission {
  id: number;
  runId: string;
  overallScore: number;
  createdAt: string;
}

export interface HumanScoreStats {
  totalScores: number;
  uniqueRuns: number;
  uniqueScorers: number;
  avgOverallScore: number;
  avgTimeSpent: number;
}

// API Client class
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    console.debug(`[HumanScorer:API] ApiClient initialized with baseUrl: ${baseUrl}`);
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const method = options?.method || 'GET';
    const startTime = Date.now();

    console.debug(`[HumanScorer:API] ${method} ${endpoint}`);
    console.debug(`[HumanScorer:API] Request URL: ${url}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const duration = Date.now() - startTime;
      console.debug(`[HumanScorer:API] Response status: ${response.status} (${duration}ms)`);

      if (!response.ok) {
        const error = await response.text();
        console.debug(`[HumanScorer:API] API error response: ${error}`);
        throw new Error(`API Error (${response.status}): ${error}`);
      }

      const data = await response.json();
      const dataSize = JSON.stringify(data).length;
      console.debug(`[HumanScorer:API] Response data size: ${dataSize} bytes`);
      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.debug(`[HumanScorer:API] Request failed after ${duration}ms:`, error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown API error');
    }
  }

  // Runs API
  async getRunDetails(runId: string): Promise<RunDetails> {
    console.debug(`[HumanScorer:API] Fetching run details for runId: ${runId}`);
    const result = await this.fetch<RunDetails>(`/api/runs/${runId}`);
    console.debug(`[HumanScorer:API] Run details loaded:`, {
      suite: result.run.suite,
      scenario: result.run.scenario,
      agent: result.run.agent,
      evaluationsCount: result.evaluations?.length || 0,
      hasTelemetry: !!result.telemetry
    });
    return result;
  }

  async getRunEvaluations(runId: string): Promise<EvaluationResult[]> {
    console.debug(`[HumanScorer:API] Fetching evaluations for runId: ${runId}`);
    const result = await this.fetch<EvaluationResult[]>(`/api/runs/${runId}/evaluations`);
    console.debug(`[HumanScorer:API] Evaluations loaded: ${result.length} evaluation(s)`);
    return result;
  }

  async getRunTelemetry(runId: string): Promise<RunTelemetry | null> {
    console.debug(`[HumanScorer:API] Fetching telemetry for runId: ${runId}`);
    const result = await this.fetch<RunTelemetry | null>(`/api/runs/${runId}/telemetry`);
    console.debug(`[HumanScorer:API] Telemetry loaded:`, result ? {
      toolCalls: result.toolCalls,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: result.costUsd
    } : 'null');
    return result;
  }

  // Human Scores API
  async submitHumanScore(runId: string, score: HumanScoreSubmission): Promise<HumanScore> {
    console.debug(`[HumanScorer:API] Submitting human score for runId: ${runId}`, {
      scorerName: score.scorerName,
      categoriesCount: score.scores?.length || 0,
      overallScore: score.overallScore
    });
    const result = await this.fetch<HumanScore>(`/api/runs/${runId}/human-scores`, {
      method: 'POST',
      body: JSON.stringify(score),
    });
    console.debug(`[HumanScorer:API] Human score submitted successfully, id: ${result.id}`);
    return result;
  }

  async getHumanScores(runId: string): Promise<HumanScore[]> {
    console.debug(`[HumanScorer:API] Fetching human scores for runId: ${runId}`);
    const result = await this.fetch<HumanScore[]>(`/api/runs/${runId}/human-scores`);
    console.debug(`[HumanScorer:API] Human scores loaded: ${result.length} score(s)`);
    return result;
  }

  async getHumanScoreStats(): Promise<HumanScoreStats> {
    return this.fetch<HumanScoreStats>('/api/human-scores/stats');
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
