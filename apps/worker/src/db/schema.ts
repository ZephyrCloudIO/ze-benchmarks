import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

export const batchRuns = sqliteTable('batch_runs', {
  batchId: text('batchId').primaryKey(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  completedAt: integer('completedAt', { mode: 'timestamp_ms' }),
  totalRuns: integer('totalRuns').default(0),
  successfulRuns: integer('successfulRuns').default(0),
  avgScore: real('avgScore'),
  avgWeightedScore: real('avgWeightedScore'),
  metadata: text('metadata'),
});

export const benchmarkRuns = sqliteTable('benchmark_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: text('run_id').unique().notNull(),
  batchId: text('batchId').references(() => batchRuns.batchId),
  suite: text('suite').notNull(),
  scenario: text('scenario').notNull(),
  tier: text('tier').notNull(),
  agent: text('agent').notNull(),
  model: text('model'),
  status: text('status').notNull(),
  startedAt: text('started_at').default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at'),
  totalScore: real('total_score'),
  weightedScore: real('weighted_score'),
  isSuccessful: integer('is_successful', { mode: 'boolean' }).default(false),
  successMetric: real('success_metric'),
  specialistEnabled: integer('specialist_enabled', { mode: 'boolean' }).default(false),
  metadata: text('metadata'),
}, (table) => ({
  suiteScenarioIdx: index('idx_runs_suite_scenario').on(table.suite, table.scenario),
  agentIdx: index('idx_runs_agent').on(table.agent),
  statusIdx: index('idx_runs_status').on(table.status),
  batchIdIdx: index('idx_runs_batchId').on(table.batchId),
  isSuccessfulIdx: index('idx_runs_is_successful').on(table.isSuccessful),
}));

export const evaluationResults = sqliteTable('evaluation_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: text('run_id').notNull().references(() => benchmarkRuns.runId),
  evaluatorName: text('evaluator_name').notNull(),
  score: real('score').notNull(),
  maxScore: real('max_score').notNull(),
  details: text('details'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  runIdIdx: index('idx_evals_run_id').on(table.runId),
}));

export const runTelemetry = sqliteTable('run_telemetry', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: text('run_id').notNull().references(() => benchmarkRuns.runId),
  toolCalls: integer('tool_calls'),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  costUsd: real('cost_usd'),
  durationMs: integer('duration_ms'),
  workspaceDir: text('workspace_dir'),
  promptSent: text('prompt_sent'),
});

// Relationships
export const batchRunsRelations = relations(batchRuns, ({ many }) => ({
  benchmarkRuns: many(benchmarkRuns),
}));

export const benchmarkRunsRelations = relations(benchmarkRuns, ({ one, many }) => ({
  batchRun: one(batchRuns, {
    fields: [benchmarkRuns.batchId],
    references: [batchRuns.batchId],
  }),
  evaluationResults: many(evaluationResults),
  telemetry: one(runTelemetry, {
    fields: [benchmarkRuns.runId],
    references: [runTelemetry.runId],
  }),
}));

export const evaluationResultsRelations = relations(evaluationResults, ({ one }) => ({
  benchmarkRun: one(benchmarkRuns, {
    fields: [evaluationResults.runId],
    references: [benchmarkRuns.runId],
  }),
}));

export const runTelemetryRelations = relations(runTelemetry, ({ one }) => ({
  benchmarkRun: one(benchmarkRuns, {
    fields: [runTelemetry.runId],
    references: [benchmarkRuns.runId],
  }),
}));

// Export types
export type BatchRun = typeof batchRuns.$inferSelect;
export type NewBatchRun = typeof batchRuns.$inferInsert;

export type BenchmarkRun = typeof benchmarkRuns.$inferSelect;
export type NewBenchmarkRun = typeof benchmarkRuns.$inferInsert;

export type EvaluationResult = typeof evaluationResults.$inferSelect;
export type NewEvaluationResult = typeof evaluationResults.$inferInsert;

export type RunTelemetry = typeof runTelemetry.$inferSelect;
export type NewRunTelemetry = typeof runTelemetry.$inferInsert;

// RoleDef tables
export const roleDefs = sqliteTable('role_defs', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  version: text('version').notNull(),
  schemaVersion: text('schema_version').notNull().default('0.0.1'),
  license: text('license').default('MIT'),
  availability: text('availability').default('public'),

  // JSON fields
  maintainers: text('maintainers').notNull(), // JSON array
  persona: text('persona').notNull(), // JSON object
  capabilities: text('capabilities').notNull(), // JSON object
  dependencies: text('dependencies').notNull(), // JSON object
  documentation: text('documentation').notNull(), // JSON array
  preferredModels: text('preferred_models').notNull(), // JSON array
  prompts: text('prompts').notNull(), // JSON object
  spawnableSubAgents: text('spawnable_sub_agents').notNull(), // JSON array

  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  nameIdx: index('idx_roledefs_name').on(table.name),
  createdAtIdx: index('idx_roledefs_created_at').on(table.createdAt),
}));

export const evaluationCriteria = sqliteTable('evaluation_criteria', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roleDefId: text('role_def_id').notNull().references(() => roleDefs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  score: integer('score').notNull(), // 1-5
  category: text('category'), // for grouping criteria
  isCustom: integer('is_custom', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  roleDefIdIdx: index('idx_criteria_roledef_id').on(table.roleDefId),
}));

// Relations
export const roleDefsRelations = relations(roleDefs, ({ many }) => ({
  evaluationCriteria: many(evaluationCriteria),
}));

export const evaluationCriteriaRelations = relations(evaluationCriteria, ({ one }) => ({
  roleDef: one(roleDefs, {
    fields: [evaluationCriteria.roleDefId],
    references: [roleDefs.id],
  }),
}));

// Export types
export type RoleDef = typeof roleDefs.$inferSelect;
export type NewRoleDef = typeof roleDefs.$inferInsert;

export type EvaluationCriteria = typeof evaluationCriteria.$inferSelect;
export type NewEvaluationCriteria = typeof evaluationCriteria.$inferInsert;
