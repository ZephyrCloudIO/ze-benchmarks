export interface Env {
  DB: D1Database;
  API_SECRET_KEY?: string;
  OPENROUTER_API_KEY?: string;
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
  isSuccessful?: boolean;
  successMetric?: number;
  specialistEnabled?: boolean;
  metadata?: Record<string, any>;
  evaluations?: Array<{
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
    promptSent?: string;
  };
}

// Human scoring types
export interface CategoryScore {
  category: string;         // e.g., "Correctness", "Code Quality"
  score: number;            // 1-5 scale
  reasoning?: string;       // Optional human explanation
  confidence?: number;      // 0-1.0: How confident in this score
}

export interface HumanScoreSubmission {
  scorerName: string;
  scorerEmail?: string;
  scores: CategoryScore[];
  overallScore?: number;    // Optional, will be calculated if not provided
  timeSpentSeconds?: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface HumanScore extends HumanScoreSubmission {
  id: number;
  runId: string;
  overallScore: number;     // 0-1.0 normalized
  createdAt: string;
}
