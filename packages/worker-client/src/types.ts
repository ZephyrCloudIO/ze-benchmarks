// Types matching the Worker API contracts

export interface BenchmarkRun {
  runId: string;
  batchId?: string;
  suite: string;
  scenario: string;
  tier: string;
  agent: string;
  model?: string;
  status: 'completed' | 'failed' | 'running';
  startedAt: string;
  completedAt?: string;
  totalScore?: number;
  weightedScore?: number;
  isSuccessful?: boolean;
  successMetric?: number;
  metadata?: Record<string, any>;
}

export interface EvaluationResult {
  evaluatorName: string;
  score: number;
  maxScore: number;
  details?: string;
}

export interface RunTelemetry {
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
  totalRuns?: number;
  successfulRuns?: number;
  avgScore?: number;
  avgWeightedScore?: number;
  metadata?: Record<string, any>;
}

export interface SubmitRunPayload {
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
}

export interface SubmitBatchPayload {
  batchId: string;
  createdAt: number;
  completedAt?: number;
  totalRuns?: number;
  successfulRuns?: number;
  avgScore?: number;
  avgWeightedScore?: number;
  metadata?: Record<string, any>;
}

export interface RunStatistics {
  total_runs: number;
  successful_runs: number;
  avg_score: number;
  avg_weighted_score: number;
  totalRuns?: number;
  successRate?: number;
  averageScore?: number;
  averageWeightedScore?: number;
  averageDuration?: number;
  evaluatorStats?: Record<string, any>;
}

export interface SuiteStatistics {
  suite: string;
  total_runs: number;
  successful_runs: number;
  avg_score: number;
  totalRuns?: number;
  successfulRuns?: number;
  avgScore?: number;
  avgWeightedScore?: number;
  avgDuration?: number;
  scenarioBreakdown?: Array<{
    scenario: string;
    totalRuns: number;
    successfulRuns: number;
    avgScore?: number;
    avgWeightedScore?: number;
  }>;
}

export interface ScenarioStatistics {
  scenario: string;
  total_runs: number;
  successful_runs: number;
  avg_score: number;
  totalRuns?: number;
  successfulRuns?: number;
  avgScore?: number;
  avgWeightedScore?: number;
  minScore?: number;
  maxScore?: number;
  avgDuration?: number;
  agentComparison?: Array<{
    agent: string;
    runs: number;
    avgScore: number;
  }>;
}

export interface DetailedRunStatistics extends BenchmarkRun {
  evaluations: EvaluationResult[];
  telemetry?: RunTelemetry;
  evaluatorStats?: Record<string, any>;
}

export interface BatchStatistics extends BatchRun {
  runs: BenchmarkRun[];
  duration?: number;
  suiteBreakdown?: Array<{
    suite: string;
    totalRuns: number;
    successfulRuns: number;
    avgScore?: number;
    avgWeightedScore?: number;
  }>;
  agentBreakdown?: Array<{
    agent: string;
    totalRuns: number;
    successfulRuns: number;
    avgScore?: number;
    avgWeightedScore?: number;
  }>;
  tierBreakdown?: Array<{
    tier: string;
    totalRuns: number;
    successfulRuns: number;
    avgScore?: number;
    avgWeightedScore?: number;
  }>;
}
