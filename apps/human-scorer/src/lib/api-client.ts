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
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error (${response.status}): ${error}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown API error');
    }
  }

  // Runs API
  async getRunDetails(runId: string): Promise<RunDetails> {
    return this.fetch<RunDetails>(`/api/runs/${runId}`);
  }

  async getRunEvaluations(runId: string): Promise<EvaluationResult[]> {
    return this.fetch<EvaluationResult[]>(`/api/runs/${runId}/evaluations`);
  }

  async getRunTelemetry(runId: string): Promise<RunTelemetry | null> {
    return this.fetch<RunTelemetry | null>(`/api/runs/${runId}/telemetry`);
  }

  // Human Scores API
  async submitHumanScore(runId: string, score: HumanScoreSubmission): Promise<HumanScore> {
    return this.fetch<HumanScore>(`/api/runs/${runId}/human-scores`, {
      method: 'POST',
      body: JSON.stringify(score),
    });
  }

  async getHumanScores(runId: string): Promise<HumanScore[]> {
    return this.fetch<HumanScore[]>(`/api/runs/${runId}/human-scores`);
  }

  async getHumanScoreStats(): Promise<HumanScoreStats> {
    return this.fetch<HumanScoreStats>('/api/human-scores/stats');
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
