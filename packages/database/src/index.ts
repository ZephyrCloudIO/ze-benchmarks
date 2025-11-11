// Export the local SQLite logger (writes directly to SQLite file)
export { BenchmarkLogger } from './logger';

// Export schema and types
export { SCHEMA } from './schema';
export type {
  RunStatistics,
  BenchmarkRun,
  EvaluationResult,
  RunTelemetry,
  SuiteStatistics,
  ScenarioStatistics,
  DetailedRunStatistics,
  BatchRun,
  BatchStatistics
} from './logger';
