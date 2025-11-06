// Export the Worker-based logger (POSTs to Worker API)
export { BenchmarkLogger } from './worker-logger';

// Legacy exports for backward compatibility
// Note: Direct database queries are deprecated - use Worker API endpoints instead
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
