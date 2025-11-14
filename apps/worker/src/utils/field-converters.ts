// Utility functions to convert database snake_case fields to API camelCase fields
// Note: Drizzle ORM already converts snake_case column names to camelCase property names,
// so these functions just pass through the data (but we keep them for consistency and future-proofing)

export function convertBenchmarkRunFields(dbRun: any) {
  if (!dbRun) return null;

  // Drizzle already converts snake_case to camelCase, so just return as-is
  return {
    id: dbRun.id,
    runId: dbRun.runId,
    batchId: dbRun.batchId,
    suite: dbRun.suite,
    scenario: dbRun.scenario,
    tier: dbRun.tier,
    agent: dbRun.agent,
    model: dbRun.model,
    status: dbRun.status,
    startedAt: dbRun.startedAt,
    completedAt: dbRun.completedAt,
    totalScore: dbRun.totalScore,
    weightedScore: dbRun.weightedScore,
    isSuccessful: dbRun.isSuccessful,
    successMetric: dbRun.successMetric,
    metadata: dbRun.metadata,
  };
}

export function convertEvaluationFields(dbEval: any) {
  if (!dbEval) return null;

  return {
    id: dbEval.id,
    runId: dbEval.runId,
    evaluatorName: dbEval.evaluatorName,
    score: dbEval.score,
    maxScore: dbEval.maxScore,
    details: dbEval.details,
    createdAt: dbEval.createdAt,
  };
}

export function convertTelemetryFields(dbTelemetry: any) {
  if (!dbTelemetry) return null;

  return {
    id: dbTelemetry.id,
    runId: dbTelemetry.runId,
    toolCalls: dbTelemetry.toolCalls,
    tokensIn: dbTelemetry.tokensIn,
    tokensOut: dbTelemetry.tokensOut,
    costUsd: dbTelemetry.costUsd,
    durationMs: dbTelemetry.durationMs,
    workspaceDir: dbTelemetry.workspaceDir,
  };
}

export function convertBatchRunFields(dbBatch: any) {
  if (!dbBatch) return null;

  // Batch fields are already in camelCase, so just return as-is
  return dbBatch;
}
