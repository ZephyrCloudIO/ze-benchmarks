// Env interface - should match worker-configuration.d.ts bindings
// Run `wrangler types` to regenerate worker-configuration.d.ts after changing wrangler.toml
export interface Env {
  // Core bindings from wrangler.toml
  DB: D1Database;
  SNAPSHOTS: R2Bucket;
  ENVIRONMENT: string;
  ALLOWED_ORIGINS?: string;

  // Secrets (set via `wrangler secret put`)
  API_SECRET_KEY?: string;
  OPENROUTER_API_KEY?: string;
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
  specialistName?: string;
  specialistVersion?: string;
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
