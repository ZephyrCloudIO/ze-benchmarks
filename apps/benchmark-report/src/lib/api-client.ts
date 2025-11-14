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
        Promise.all(
          runs
            .slice(0, 50)
            .filter(r => r && r.runId) // Filter out runs with undefined runId
            .map(r => this.getRunTelemetry(r.runId))
        )
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
    const costPromises = Array.from(
      runs
        .slice(0, 100)
        .filter(r => r && r.runId) // Filter out runs with undefined runId
        .map(r =>
          this.getRunTelemetry(r.runId).then(t => ({ runId: r.runId, cost: t?.costUsd || 0 }))
        )
    );
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

  // Agent performance stats with detailed metrics
  async getAgentPerformanceStats(): Promise<Array<{
    agent: string;
    model: string;
    avgScore: number;
    successRate: number;
    avgCost: number;
    avgDuration: number;
    totalRuns: number;
  }>> {
    const runs = await this.listRuns({ limit: 10000, status: 'completed' });

    // Group by agent + model
    const grouped = new Map<string, {
      agent: string;
      model: string;
      scores: number[];
      successCount: number;
      totalCount: number;
      runIds: string[];
    }>();

    for (const run of runs) {
      const key = `${run.agent}::${run.model || 'no-model'}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          agent: run.agent,
          model: run.model || '',
          scores: [],
          successCount: 0,
          totalCount: 0,
          runIds: [],
        });
      }

      const group = grouped.get(key)!;
      group.totalCount++;
      group.runIds.push(run.runId);

      if (run.isSuccessful) {
        group.successCount++;
      }

      if (run.weightedScore !== null && run.weightedScore !== undefined) {
        group.scores.push(run.weightedScore);
      }
    }

    // Fetch telemetry for cost and duration data (sample for performance)
    const sampleSize = 50;
    const telemetryPromises: Promise<{ runId: string; telemetry: RunTelemetry | null }>[] = [];

    for (const group of grouped.values()) {
      const sampleIds = group.runIds
        .filter(id => id !== undefined && id !== null) // Filter out undefined runIds
        .slice(0, Math.min(sampleSize, group.runIds.length));
      for (const runId of sampleIds) {
        telemetryPromises.push(
          this.getRunTelemetry(runId).then(t => ({ runId, telemetry: t }))
        );
      }
    }

    const telemetries = await Promise.all(telemetryPromises);
    const telemetryMap = new Map(telemetries.map(t => [t.runId, t.telemetry]));

    // Calculate stats
    const stats = Array.from(grouped.entries()).map(([key, group]) => {
      const avgScore = group.scores.length > 0
        ? group.scores.reduce((a, b) => a + b, 0) / group.scores.length
        : 0;

      const successRate = (group.successCount / group.totalCount) * 100;

      // Calculate cost and duration from sampled telemetry
      const groupTelemetries = group.runIds
        .map(id => telemetryMap.get(id))
        .filter((t): t is RunTelemetry => t !== null && t !== undefined);

      const avgCost = groupTelemetries.length > 0
        ? groupTelemetries.reduce((sum, t) => sum + (t.costUsd || 0), 0) / groupTelemetries.length
        : 0;

      const avgDuration = groupTelemetries.length > 0
        ? groupTelemetries.reduce((sum, t) => sum + (t.durationMs || 0), 0) / groupTelemetries.length
        : 0;

      return {
        agent: group.agent,
        model: group.model,
        avgScore,
        successRate,
        avgCost,
        avgDuration,
        totalRuns: group.totalCount,
      };
    });

    return stats.sort((a, b) => b.avgScore - a.avgScore);
  }

  // Suite and scenario statistics
  async getSuiteStats(): Promise<Array<{
    suite: string;
    totalRuns: number;
    successRate: number;
    avgScore: number;
    uniqueScenarios: number;
  }>> {
    const runs = await this.listRuns({ limit: 10000 });

    const grouped = new Map<string, {
      suite: string;
      totalCount: number;
      successCount: number;
      scores: number[];
      scenarios: Set<string>;
    }>();

    for (const run of runs) {
      if (!grouped.has(run.suite)) {
        grouped.set(run.suite, {
          suite: run.suite,
          totalCount: 0,
          successCount: 0,
          scores: [],
          scenarios: new Set(),
        });
      }

      const group = grouped.get(run.suite)!;
      group.totalCount++;
      group.scenarios.add(run.scenario);

      if (run.status === 'completed') {
        group.successCount++;
      }

      if (run.weightedScore !== null && run.weightedScore !== undefined) {
        group.scores.push(run.weightedScore);
      }
    }

    return Array.from(grouped.values())
      .map(g => ({
        suite: g.suite,
        totalRuns: g.totalCount,
        successRate: (g.successCount / g.totalCount) * 100,
        avgScore: g.scores.length > 0 ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length : 0,
        uniqueScenarios: g.scenarios.size,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }

  async getScenarioStats(): Promise<Array<{
    suite: string;
    scenario: string;
    tier: string;
    totalRuns: number;
    successRate: number;
    avgScore: number;
    minScore: number;
    maxScore: number;
  }>> {
    const runs = await this.listRuns({ limit: 10000 });

    const grouped = new Map<string, {
      suite: string;
      scenario: string;
      tier: string;
      totalCount: number;
      successCount: number;
      scores: number[];
    }>();

    for (const run of runs) {
      const key = `${run.suite}::${run.scenario}::${run.tier}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          suite: run.suite,
          scenario: run.scenario,
          tier: run.tier,
          totalCount: 0,
          successCount: 0,
          scores: [],
        });
      }

      const group = grouped.get(key)!;
      group.totalCount++;

      if (run.status === 'completed') {
        group.successCount++;
      }

      if (run.weightedScore !== null && run.weightedScore !== undefined) {
        group.scores.push(run.weightedScore);
      }
    }

    return Array.from(grouped.values())
      .map(g => ({
        suite: g.suite,
        scenario: g.scenario,
        tier: g.tier,
        totalRuns: g.totalCount,
        successRate: (g.successCount / g.totalCount) * 100,
        avgScore: g.scores.length > 0 ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length : 0,
        minScore: g.scores.length > 0 ? Math.min(...g.scores) : 0,
        maxScore: g.scores.length > 0 ? Math.max(...g.scores) : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 50);
  }

  // Evaluator statistics
  async getEvaluatorStats(): Promise<Array<{
    evaluatorName: string;
    avgScore: number;
    passRate: number;
    totalEvaluations: number;
    avgMaxScore: number;
    minScore: number;
    maxScore: number;
  }>> {
    // Get a sample of runs to fetch evaluations from
    const runs = await this.listRuns({ limit: 1000, status: 'completed' });

    // Fetch evaluations for all runs
    const evaluationPromises = runs
      .filter(r => r && r.runId) // Filter out runs with undefined runId
      .map(run =>
        this.getRunEvaluations(run.runId).catch(() => [])
      );
    const allEvaluations = (await Promise.all(evaluationPromises)).flat();

    // Group by evaluator name
    const grouped = new Map<string, {
      scores: number[];
      maxScores: number[];
      passCount: number;
    }>();

    for (const evaluation of allEvaluations) {
      if (!grouped.has(evaluation.evaluatorName)) {
        grouped.set(evaluation.evaluatorName, {
          scores: [],
          maxScores: [],
          passCount: 0,
        });
      }

      const group = grouped.get(evaluation.evaluatorName)!;
      group.scores.push(evaluation.score);
      group.maxScores.push(evaluation.maxScore);

      if (evaluation.score >= evaluation.maxScore) {
        group.passCount++;
      }
    }

    return Array.from(grouped.entries())
      .map(([evaluatorName, data]) => ({
        evaluatorName,
        avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        passRate: (data.passCount / data.scores.length) * 100,
        totalEvaluations: data.scores.length,
        avgMaxScore: data.maxScores.reduce((a, b) => a + b, 0) / data.maxScores.length,
        minScore: Math.min(...data.scores),
        maxScore: Math.max(...data.scores),
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }

  // Cost analysis
  async getCostStats(): Promise<{
    totalCost: number;
    avgCost: number;
    totalRuns: number;
  }> {
    const runs = await this.listRuns({ limit: 1000, status: 'completed' });

    const telemetryPromises = runs
      .filter(r => r && r.runId) // Filter out runs with undefined runId
      .map(run => this.getRunTelemetry(run.runId));
    const telemetries = await Promise.all(telemetryPromises);

    const validTelemetries = telemetries.filter(
      (t): t is RunTelemetry => t !== null && t.costUsd !== null && t.costUsd !== undefined
    );

    const totalCost = validTelemetries.reduce((sum, t) => sum + (t.costUsd || 0), 0);
    const avgCost = validTelemetries.length > 0 ? totalCost / validTelemetries.length : 0;

    return {
      totalCost,
      avgCost,
      totalRuns: validTelemetries.length,
    };
  }

  async getCostEfficiency(): Promise<Array<{
    agent: string;
    model: string;
    avgCost: number;
    avgScore: number;
    totalRuns: number;
    scorePerDollar: number;
  }>> {
    const runs = await this.listRuns({ limit: 2000, status: 'completed' });

    // Group by agent + model
    const grouped = new Map<string, {
      agent: string;
      model: string;
      scores: number[];
      runIds: string[];
    }>();

    for (const run of runs) {
      if (run.weightedScore === null || run.weightedScore === undefined) continue;

      const key = `${run.agent}::${run.model || 'no-model'}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          agent: run.agent,
          model: run.model || '',
          scores: [],
          runIds: [],
        });
      }

      const group = grouped.get(key)!;
      group.scores.push(run.weightedScore);
      group.runIds.push(run.runId);
    }

    // Fetch telemetry for cost data (sample for performance)
    const telemetryPromises: Promise<{ runId: string; cost: number }>[] = [];
    for (const group of grouped.values()) {
      const sampleIds = group.runIds
        .filter(id => id !== undefined && id !== null) // Filter out undefined runIds
        .slice(0, Math.min(50, group.runIds.length));
      for (const runId of sampleIds) {
        telemetryPromises.push(
          this.getRunTelemetry(runId).then(t => ({ runId, cost: t?.costUsd || 0 }))
        );
      }
    }

    const costs = await Promise.all(telemetryPromises);
    const costMap = new Map(costs.map(c => [c.runId, c.cost]));

    // Calculate efficiency
    const efficiency = Array.from(grouped.entries()).map(([key, group]) => {
      const groupCosts = group.runIds
        .map(id => costMap.get(id))
        .filter((c): c is number => c !== undefined && c > 0);

      const avgCost = groupCosts.length > 0
        ? groupCosts.reduce((a, b) => a + b, 0) / groupCosts.length
        : 0;

      const avgScore = group.scores.reduce((a, b) => a + b, 0) / group.scores.length;
      const scorePerDollar = avgCost > 0 ? avgScore / avgCost : 0;

      return {
        agent: group.agent,
        model: group.model,
        avgCost,
        avgScore,
        totalRuns: group.scores.length,
        scorePerDollar,
      };
    });

    return efficiency.sort((a, b) => b.scorePerDollar - a.scorePerDollar);
  }

  async getCostBreakdown(): Promise<Array<{ name: string; value: number }>> {
    const runs = await this.listRuns({ limit: 2000, status: 'completed' });

    const grouped = new Map<string, number>();

    const telemetryPromises = runs
      .filter(r => r && r.runId) // Filter out runs with undefined runId
      .map(async run => {
        const telemetry = await this.getRunTelemetry(run.runId);
        return { agent: run.agent, cost: telemetry?.costUsd || 0 };
      });

    const results = await Promise.all(telemetryPromises);

    for (const { agent, cost } of results) {
      grouped.set(agent, (grouped.get(agent) || 0) + cost);
    }

    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }

  async getTokenUsage(): Promise<Array<{
    agent: string;
    model: string;
    avgTokensIn: number;
    avgTokensOut: number;
    totalTokens: number;
  }>> {
    const runs = await this.listRuns({ limit: 1000, status: 'completed' });

    const grouped = new Map<string, {
      agent: string;
      model: string;
      tokensIn: number[];
      tokensOut: number[];
    }>();

    const telemetryPromises = runs
      .filter(r => r && r.runId) // Filter out runs with undefined runId
      .map(async run => {
        const telemetry = await this.getRunTelemetry(run.runId);
        return { run, telemetry };
      });

    const results = await Promise.all(telemetryPromises);

    for (const { run, telemetry } of results) {
      if (!telemetry) continue;

      const key = `${run.agent}::${run.model || 'no-model'}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          agent: run.agent,
          model: run.model || '',
          tokensIn: [],
          tokensOut: [],
        });
      }

      const group = grouped.get(key)!;
      if (telemetry.tokensIn) group.tokensIn.push(telemetry.tokensIn);
      if (telemetry.tokensOut) group.tokensOut.push(telemetry.tokensOut);
    }

    return Array.from(grouped.values())
      .map(g => ({
        agent: g.agent,
        model: g.model,
        avgTokensIn: g.tokensIn.length > 0 ? g.tokensIn.reduce((a, b) => a + b, 0) / g.tokensIn.length : 0,
        avgTokensOut: g.tokensOut.length > 0 ? g.tokensOut.reduce((a, b) => a + b, 0) / g.tokensOut.length : 0,
        totalTokens: (g.tokensIn.reduce((a, b) => a + b, 0) + g.tokensOut.reduce((a, b) => a + b, 0)) / Math.max(g.tokensIn.length, g.tokensOut.length, 1),
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 10);
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
