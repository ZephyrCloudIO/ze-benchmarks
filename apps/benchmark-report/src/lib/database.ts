/**
 * Worker API client for benchmark dashboard
 * Replaces sql.js SQLite with HTTP API calls
 */

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';

// Type definitions matching Worker API responses
export interface BenchmarkRun {
  id?: number;
  run_id?: string;
  runId?: string;
  batchId?: string;
  suite: string;
  scenario: string;
  tier: string;
  agent: string;
  model?: string;
  status: 'running' | 'completed' | 'failed';
  started_at?: string;
  startedAt?: string;
  completed_at?: string;
  completedAt?: string;
  total_score?: number;
  totalScore?: number;
  weighted_score?: number;
  weightedScore?: number;
  is_successful?: boolean;
  isSuccessful?: boolean;
  success_metric?: number;
  successMetric?: number;
  metadata?: string | Record<string, any>;
}

export interface EvaluationResult {
  id?: number;
  run_id?: string;
  runId?: string;
  evaluator_name?: string;
  evaluatorName?: string;
  score: number;
  max_score?: number;
  maxScore?: number;
  details?: string;
  created_at?: string;
  createdAt?: string;
}

export interface RunTelemetry {
  id?: number;
  run_id?: string;
  runId?: string;
  tool_calls?: number;
  toolCalls?: number;
  tokens_in?: number;
  tokensIn?: number;
  tokens_out?: number;
  tokensOut?: number;
  cost_usd?: number;
  costUsd?: number;
  duration_ms?: number;
  durationMs?: number;
  workspace_dir?: string;
  workspaceDir?: string;
}

export interface BatchRun {
  batchId: string;
  createdAt: number;
  completedAt?: number;
  totalRuns: number;
  successfulRuns: number;
  avgScore?: number;
  avgWeightedScore?: number;
  metadata?: string | Record<string, any>;
}

export interface DetailedRun extends BenchmarkRun {
  evaluations?: EvaluationResult[];
  telemetry?: RunTelemetry;
}

export interface DetailedBatch extends BatchRun {
  runs?: BenchmarkRun[];
}

/**
 * Fetch helper with error handling
 */
async function fetchAPI<T>(path: string): Promise<T> {
  const url = `${WORKER_URL}${path}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`Failed to fetch ${path}:`, error);
    throw new Error(`Worker API error: ${error.message}`);
  }
}

/**
 * Initialize database (compatibility with old API, now just checks worker health)
 */
export async function initDatabase(): Promise<void> {
  try {
    const response = await fetch(`${WORKER_URL}/health`);
    if (!response.ok) {
      throw new Error(`Worker not accessible: ${response.statusText}`);
    }
  } catch (error: any) {
    console.error('Failed to connect to worker:', error);
    throw new Error(`Worker not running at ${WORKER_URL}. Please start it with: cd apps/worker && pnpm dev`);
  }
}

/**
 * Execute a SQL query (compatibility layer - translates to API calls)
 * Note: Only supports specific queries used by the dashboard
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  // Parse the SQL to determine what API endpoint to call
  const sqlLower = sql.toLowerCase().trim();

  // List all runs
  if (sqlLower.includes('from benchmark_runs') && sqlLower.includes('order by started_at desc')) {
    const limit = sqlLower.match(/limit\s+(\d+)/)?.[1];
    const runs = await fetchAPI<BenchmarkRun[]>(`/api/runs${limit ? `?limit=${limit}` : ''}`);
    return runs as T[];
  }

  // Get run details
  if (sqlLower.includes('from benchmark_runs') && sqlLower.includes('where run_id')) {
    const runId = params[0] as string;
    const run = await fetchAPI<DetailedRun>(`/api/runs/${runId}`);
    return [run] as T[];
  }

  // Get evaluations for a run
  if (sqlLower.includes('from evaluation_results') && sqlLower.includes('where run_id')) {
    const runId = params[0] as string;
    const run = await fetchAPI<DetailedRun>(`/api/runs/${runId}`);
    return (run.evaluations || []) as T[];
  }

  // Get telemetry for a run
  if (sqlLower.includes('from run_telemetry') && sqlLower.includes('where run_id')) {
    const runId = params[0] as string;
    const run = await fetchAPI<DetailedRun>(`/api/runs/${runId}`);
    return run.telemetry ? [run.telemetry] as T[] : [];
  }

  // List all batches
  if (sqlLower.includes('from batch_runs') && sqlLower.includes('order by')) {
    const limit = sqlLower.match(/limit\s+(\d+)/)?.[1];
    const batches = await fetchAPI<BatchRun[]>(`/api/batches${limit ? `?limit=${limit}` : ''}`);
    return batches as T[];
  }

  // Get batch details
  if (sqlLower.includes('from batch_runs') && sqlLower.includes('where "batchId"')) {
    const batchId = params[0] as string;
    const batch = await fetchAPI<DetailedBatch>(`/api/batches/${batchId}`);
    return [batch] as T[];
  }

  // Get runs for a batch
  if (sqlLower.includes('from benchmark_runs') && sqlLower.includes('where "batchId"')) {
    const batchId = params[0] as string;
    const batch = await fetchAPI<DetailedBatch>(`/api/batches/${batchId}`);
    return (batch.runs || []) as T[];
  }

  // Global stats
  if (sqlLower.includes('count(*)') && sqlLower.includes('from benchmark_runs')) {
    const stats = await fetchAPI<any>('/api/stats');
    return [stats] as T[];
  }

  console.warn(`Unsupported SQL query: ${sql}`);
  return [];
}

/**
 * Execute a SQL query and return the first result
 */
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Execute a SQL query and return the first column of the first row
 */
export async function queryScalar<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const results = await query<any>(sql, params);
  if (results.length === 0) return null;

  const firstRow = results[0];
  const firstKey = Object.keys(firstRow)[0];
  return firstRow[firstKey] as T;
}

/**
 * Close the database connection (no-op for HTTP client)
 */
export function closeDatabase(): void {
  // No connection to close
}

/**
 * Reload the database from disk (no-op for HTTP client, data is always fresh)
 */
export async function reloadDatabase(): Promise<void> {
  // Data is fetched fresh on each request
}

/**
 * Watch the database for changes and reload automatically
 * For HTTP API, we just poll at intervals
 */
export function watchDatabase(callback: () => void, intervalMs = 5000): () => void {
  const interval = setInterval(() => {
    callback();
  }, intervalMs);

  return () => clearInterval(interval);
}

/**
 * Direct API helpers (preferred over SQL compatibility layer)
 */
export const api = {
  /**
   * List all runs
   */
  async listRuns(params?: { suite?: string; scenario?: string; agent?: string; limit?: number }): Promise<BenchmarkRun[]> {
    const queryParams = new URLSearchParams();
    if (params?.suite) queryParams.set('suite', params.suite);
    if (params?.scenario) queryParams.set('scenario', params.scenario);
    if (params?.agent) queryParams.set('agent', params.agent);
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    return fetchAPI<BenchmarkRun[]>(`/api/runs${queryParams.toString() ? '?' + queryParams : ''}`);
  },

  /**
   * Get run details with evaluations and telemetry
   */
  async getRunDetails(runId: string): Promise<DetailedRun> {
    return fetchAPI<DetailedRun>(`/api/runs/${runId}`);
  },

  /**
   * List all batches
   */
  async listBatches(limit?: number): Promise<BatchRun[]> {
    return fetchAPI<BatchRun[]>(`/api/batches${limit ? `?limit=${limit}` : ''}`);
  },

  /**
   * Get batch details with runs
   */
  async getBatchDetails(batchId: string): Promise<DetailedBatch> {
    return fetchAPI<DetailedBatch>(`/api/batches/${batchId}`);
  },

  /**
   * Get global statistics
   */
  async getGlobalStats(): Promise<any> {
    return fetchAPI<any>('/api/stats');
  },

  /**
   * Get agent-specific statistics
   */
  async getAgentStats(): Promise<Array<{ agent: string; stats: any }>> {
    return fetchAPI<Array<{ agent: string; stats: any }>>('/api/stats/agents');
  },

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${WORKER_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
};
