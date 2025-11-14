export interface Env {
  DB: D1Database;
  API_SECRET_KEY?: string;
  ENVIRONMENT: string;
}

export interface SubmitResultsPayload {
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
  isSuccessful: boolean;
  successMetric?: number;
  metadata?: Record<string, any>;
  evaluations: Array<{
    evaluatorName: string;
    score: number;
    maxScore: number;
    details?: string;
  }>;
  telemetry?: {
    toolCalls?: number;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
    durationMs?: number;
    workspaceDir?: string;
  };
}
