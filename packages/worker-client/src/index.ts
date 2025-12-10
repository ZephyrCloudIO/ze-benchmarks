// Export Worker API client
export { WorkerClient, getWorkerClient } from './client';
export type { WorkerClientConfig } from './client';

// Export logger (drop-in replacement for @ze/database)
export { BenchmarkLogger } from './logger';

// Export all types
export type {
  BenchmarkRun,
  EvaluationResult,
  RunTelemetry,
  BatchRun,
  SubmitRunPayload,
  SubmitBatchPayload,
  RunStatistics,
  SuiteStatistics,
  ScenarioStatistics,
  DetailedRunStatistics,
  BatchStatistics,
  // Snapshot types
  SnapshotMetadata,
  UploadSnapshotPayload,
  UploadSnapshotResponse,
  DownloadSnapshotResponse,
  ListSnapshotsResponse,
} from './types';
