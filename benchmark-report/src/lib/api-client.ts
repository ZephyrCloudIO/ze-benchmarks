// API Client for interacting with the Cloudflare Worker backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

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
}

export interface BatchRun {
  batchId: string;
  createdAt: number;
  completedAt?: number;
  totalRuns: number;
  successfulRuns: number;
  avgScore?: number;
  avgWeightedScore?: number;
  metadata?: string;
}

export interface GlobalStats {
  totalRuns: number;
  successfulRuns: number;
  avgScore: number;
  avgWeightedScore: number;
}

export interface AgentStats {
  agent: string;
  runs: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
}

export interface RunDetails {
  run: BenchmarkRun;
  evaluations: EvaluationResult[];
  telemetry: RunTelemetry | null;
}

export interface BatchDetails extends BatchRun {
  runs: BenchmarkRun[];
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
  async listRuns(params?: {
    limit?: number;
    suite?: string;
    scenario?: string;
    agent?: string;
    status?: string;
  }): Promise<BenchmarkRun[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.suite) searchParams.set('suite', params.suite);
    if (params?.scenario) searchParams.set('scenario', params.scenario);
    if (params?.agent) searchParams.set('agent', params.agent);
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    return this.fetch<BenchmarkRun[]>(`/api/runs${query ? `?${query}` : ''}`);
  }

  async getRunDetails(runId: string): Promise<RunDetails> {
    return this.fetch<RunDetails>(`/api/runs/${runId}`);
  }

  async getRunEvaluations(runId: string): Promise<EvaluationResult[]> {
    return this.fetch<EvaluationResult[]>(`/api/runs/${runId}/evaluations`);
  }

  async getRunTelemetry(runId: string): Promise<RunTelemetry | null> {
    return this.fetch<RunTelemetry | null>(`/api/runs/${runId}/telemetry`);
  }

  // Batches API
  async listBatches(limit: number = 20): Promise<BatchRun[]> {
    return this.fetch<BatchRun[]>(`/api/batches?limit=${limit}`);
  }

  async getBatchDetails(batchId: string): Promise<BatchDetails> {
    return this.fetch<BatchDetails>(`/api/batches/${batchId}`);
  }

  // Stats API
  async getGlobalStats(): Promise<GlobalStats> {
    return this.fetch<GlobalStats>('/api/stats');
  }

  async getAgentStats(): Promise<AgentStats[]> {
    return this.fetch<AgentStats[]>('/api/stats/agents');
  }

  // Custom aggregation queries (computed on client-side from API data)
  async getDashboardStats(): Promise<{
    totalRuns: number;
    successRate: number;
    avgScore: number;
    avgCost: number;
  }> {
    const [stats, runs, telemetries] = await Promise.all([
      this.getGlobalStats(),
      this.listRuns({ limit: 1000 }), // Get a large sample for accurate stats
      // We'll compute avgCost from run details
      this.listRuns({ limit: 50, status: 'completed' }).then(runs =>
        Promise.all(runs.slice(0, 50).map(r => this.getRunTelemetry(r.runId)))
      )
    ]);

    const totalRuns = stats.totalRuns;
    const successRate = (stats.successfulRuns / totalRuns) * 100;
    const avgScore = stats.avgWeightedScore || 0;

    // Calculate average cost from telemetry data
    const costsWithData = telemetries.filter(t => t && t.costUsd !== null && t.costUsd !== undefined);
    const avgCost = costsWithData.length > 0
      ? costsWithData.reduce((sum, t) => sum + (t!.costUsd || 0), 0) / costsWithData.length
      : 0;

    return {
      totalRuns,
      successRate,
      avgScore,
      avgCost,
    };
  }

  async getTopPerformers(limit: number = 5): Promise<Array<{
    agent: string;
    model: string;
    avgScore: number;
    runCount: number;
    avgCost: number;
  }>> {
    const runs = await this.listRuns({ limit: 1000, status: 'completed' });

    // Group by agent + model
    const grouped = new Map<string, {
      agent: string;
      model: string;
      scores: number[];
      costs: number[];
    }>();

    for (const run of runs) {
      if (run.weightedScore === null || run.weightedScore === undefined) continue;

      const key = `${run.agent}::${run.model || 'no-model'}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          agent: run.agent,
          model: run.model || '',
          scores: [],
          costs: [],
        });
      }

      const group = grouped.get(key)!;
      group.scores.push(run.weightedScore);
    }

    // Fetch costs for these runs
    const costPromises = Array.from(runs.slice(0, 100).map(r =>
      this.getRunTelemetry(r.runId).then(t => ({ runId: r.runId, cost: t?.costUsd || 0 }))
    ));
    const costs = await Promise.all(costPromises);
    const costMap = new Map(costs.map(c => [c.runId, c.cost]));

    // Add costs to groups
    for (const run of runs) {
      const key = `${run.agent}::${run.model || 'no-model'}`;
      const group = grouped.get(key);
      if (group && costMap.has(run.runId)) {
        group.costs.push(costMap.get(run.runId)!);
      }
    }

    // Calculate averages and sort
    const performers = Array.from(grouped.values())
      .map(g => ({
        agent: g.agent,
        model: g.model,
        avgScore: g.scores.reduce((a, b) => a + b, 0) / g.scores.length,
        runCount: g.scores.length,
        avgCost: g.costs.length > 0 ? g.costs.reduce((a, b) => a + b, 0) / g.costs.length : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, limit);

    return performers;
  }

  async getScoreDistribution(): Promise<Array<{ range: string; count: number }>> {
    const runs = await this.listRuns({ limit: 10000, status: 'completed' });

    const ranges = [
      { min: 9, max: 10, label: '9-10' },
      { min: 7, max: 9, label: '7-9' },
      { min: 5, max: 7, label: '5-7' },
      { min: 3, max: 5, label: '3-5' },
      { min: 0, max: 3, label: '0-3' },
    ];

    const distribution = ranges.map(range => ({
      range: range.label,
      count: runs.filter(r =>
        r.weightedScore !== null &&
        r.weightedScore !== undefined &&
        r.weightedScore >= range.min &&
        r.weightedScore < range.max
      ).length,
    }));

    return distribution.reverse(); // Return in ascending order
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
