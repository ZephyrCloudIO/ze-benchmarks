// Utility functions to convert database snake_case fields to API camelCase fields

export function convertBenchmarkRunFields(dbRun: any) {
  if (!dbRun) return null;

  return {
    id: dbRun.id,
    runId: dbRun.run_id,
    batchId: dbRun.batchId,
    suite: dbRun.suite,
    scenario: dbRun.scenario,
    tier: dbRun.tier,
    agent: dbRun.agent,
    model: dbRun.model,
    status: dbRun.status,
    startedAt: dbRun.started_at,
    completedAt: dbRun.completed_at,
    totalScore: dbRun.total_score,
    weightedScore: dbRun.weighted_score,
    isSuccessful: dbRun.is_successful,
    successMetric: dbRun.success_metric,
    metadata: dbRun.metadata,
  };
}

export function convertEvaluationFields(dbEval: any) {
  if (!dbEval) return null;

  return {
    id: dbEval.id,
    runId: dbEval.run_id,
    evaluatorName: dbEval.evaluator_name,
    score: dbEval.score,
    maxScore: dbEval.max_score,
    details: dbEval.details,
    createdAt: dbEval.created_at,
  };
}

export function convertTelemetryFields(dbTelemetry: any) {
  if (!dbTelemetry) return null;

  return {
    id: dbTelemetry.id,
    runId: dbTelemetry.run_id,
    toolCalls: dbTelemetry.tool_calls,
    tokensIn: dbTelemetry.tokens_in,
    tokensOut: dbTelemetry.tokens_out,
    costUsd: dbTelemetry.cost_usd,
    durationMs: dbTelemetry.duration_ms,
    workspaceDir: dbTelemetry.workspace_dir,
  };
}

export function convertBatchRunFields(dbBatch: any) {
  if (!dbBatch) return null;

  // Batch fields are already in camelCase, so just return as-is
  return dbBatch;
}
