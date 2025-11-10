import initSqlJs, { type Database } from 'sql.js';

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

/**
 * Initialize and load the SQLite database
 * This function caches the database instance for reuse
 */
export async function initDatabase(): Promise<Database> {
  // Return cached instance if already initialized
  if (dbInstance) {
    return dbInstance;
  }

  // Return existing initialization promise if in progress
  if (initPromise) {
    return initPromise;
  }

  // Create new initialization promise
  initPromise = (async () => {
    try {
      // Initialize sql.js with the WASM binary
      const SQL = await initSqlJs({
        locateFile: (file) => `/sql-wasm.wasm`,
      });

      // Fetch the database file
      const response = await fetch('/benchmarks.db');
      if (!response.ok) {
        throw new Error(`Failed to load database: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const db = new SQL.Database(new Uint8Array(buffer));

      dbInstance = db;
      return db;
    } catch (error) {
      initPromise = null; // Reset on error so it can be retried
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Execute a SQL query and return results as typed objects
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await initDatabase();

  const results: T[] = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);

  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row as T);
  }

  stmt.free();
  return results;
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
  const db = await initDatabase();

  const stmt = db.prepare(sql);
  stmt.bind(params);

  let result: T | null = null;
  if (stmt.step()) {
    const row = stmt.get();
    result = row[0] as T;
  }

  stmt.free();
  return result;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    initPromise = null;
  }
}

/**
 * Reload the database from disk
 * Useful for refreshing data when the database file changes
 */
export async function reloadDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    initPromise = null;
  }
  await initDatabase();
}

/**
 * Watch the database for changes and reload automatically
 * Returns a function to stop watching
 */
export function watchDatabase(callback: () => void, intervalMs = 5000): () => void {
  const interval = setInterval(async () => {
    try {
      await reloadDatabase();
      callback();
    } catch (err) {
      console.error('Failed to reload database:', err);
    }
  }, intervalMs);
  
  return () => clearInterval(interval);
}

// Type definitions for database tables
export interface BenchmarkRun {
  id: number;
  run_id: string;
  batchId?: string;
  suite: string;
  scenario: string;
  tier: string;
  agent: string;
  model?: string;
  status: 'running' | 'completed' | 'failed' | 'incomplete';
  started_at: string;
  completed_at?: string;
  total_score?: number;
  weighted_score?: number;
  is_successful?: boolean;
  success_metric?: number;
  package_manager?: string;
  test_results?: string;
  metadata?: string;
}

export interface EvaluationResult {
  id: number;
  run_id: string;
  evaluator_name: string;
  score: number;
  max_score: number;
  details?: string;
  created_at: string;
}

export interface RunTelemetry {
  id: number;
  run_id: string;
  tool_calls?: number;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  duration_ms?: number;
  workspace_dir?: string;
}

export interface BatchRun {
  batchId: string;
  createdAt: number;
  completedAt?: number;
  totalRuns: number;
  successfulRuns: number;
  avgScore?: number;
  avgWeightedScore?: number;
  metadata?: string;
}

/**
 * Centralized, typed query helpers for charts and pages
 */
export interface GetRunsFilter {
  statusIn?: Array<'running' | 'completed' | 'failed' | 'incomplete'>;
  suite?: string;
  scenario?: string;
  tier?: string;
  agent?: string;
  model?: string;
  batchId?: string;
}

export async function getRuns(filter: GetRunsFilter = {}): Promise<BenchmarkRun[]> {
  const where: string[] = [];
  const params: any[] = [];

  if (filter.statusIn && filter.statusIn.length > 0) {
    where.push(`status IN (${filter.statusIn.map(() => '?').join(',')})`);
    params.push(...filter.statusIn);
  }
  if (filter.suite) { where.push('suite = ?'); params.push(filter.suite); }
  if (filter.scenario) { where.push('scenario = ?'); params.push(filter.scenario); }
  if (filter.tier) { where.push('tier = ?'); params.push(filter.tier); }
  if (filter.agent) { where.push('agent = ?'); params.push(filter.agent); }
  if (filter.model) { where.push('model = ?'); params.push(filter.model); }
  if (filter.batchId) { where.push('batchId = ?'); params.push(filter.batchId); }

  const sql = `
    SELECT id, run_id, batchId, suite, scenario, tier, agent, model, status,
           started_at, completed_at, total_score, weighted_score,
           is_successful, success_metric, metadata
    FROM benchmark_runs
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY datetime(started_at) DESC
  `;

  return query<BenchmarkRun>(sql, params);
}

export async function getTelemetryByRun(runIds?: string[]): Promise<RunTelemetry[]> {
  const where: string[] = [];
  const params: any[] = [];
  if (runIds && runIds.length > 0) {
    where.push(`run_id IN (${runIds.map(() => '?').join(',')})`);
    params.push(...runIds);
  }
  const sql = `
    SELECT id, run_id, tool_calls, tokens_in, tokens_out, cost_usd, duration_ms, workspace_dir
    FROM run_telemetry
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
  `;
  return query<RunTelemetry>(sql, params);
}

export interface BatchAggregate {
  batchId: string;
  totalRuns: number;
  successfulRuns: number;
  avgScore: number | null;
  avgWeightedScore: number | null;
}

export async function getBatchAggregates(batchIds?: string[]): Promise<BatchAggregate[]> {
  const where: string[] = [];
  const params: any[] = [];
  if (batchIds && batchIds.length > 0) {
    where.push(`br.batchId IN (${batchIds.map(() => '?').join(',')})`);
    params.push(...batchIds);
  }
  const sql = `
    SELECT br.batchId,
           COUNT(*) as totalRuns,
           SUM(CASE WHEN br.status = 'completed' THEN 1 ELSE 0 END) as successfulRuns,
           AVG(br.total_score) as avgScore,
           AVG(br.weighted_score) as avgWeightedScore
    FROM benchmark_runs br
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY br.batchId
    ORDER BY MAX(datetime(br.started_at)) DESC
  `;
  return query<BatchAggregate>(sql, params);
}

export interface HistogramBin {
  range: string; // e.g. "6.0–7.0"
  count: number;
  from: number; // inclusive, 0–1
  to: number;   // exclusive except last, 0–1
}

export async function getScoreDistribution(bins = 10): Promise<HistogramBin[]> {
  // Fetch weighted scores and compute histogram client-side for flexibility
  const rows = await query<{ weighted_score: number }>(
    `SELECT weighted_score FROM benchmark_runs WHERE weighted_score IS NOT NULL`
  );
  const scores = rows.map(r => r.weighted_score).filter(s => typeof s === 'number');
  if (scores.length === 0 || bins <= 0) return [];

  const min = 0;
  const max = 1;
  const width = (max - min) / bins;
  const buckets: HistogramBin[] = Array.from({ length: bins }, (_, i) => {
    const from = min + i * width;
    const to = i === bins - 1 ? max : from + width;
    const label = `${(from * 10).toFixed(1)}–${(to * 10).toFixed(1)}`;
    return { range: label, count: 0, from, to };
  });

  for (const s of scores) {
    const clamped = Math.max(0, Math.min(1, s));
    let idx = Math.floor((clamped - min) / width);
    if (idx >= bins) idx = bins - 1; // include 1.0 in last bin
    buckets[idx].count += 1;
  }

  return buckets;
}

export type TimeBucket = 'day' | 'week';
export interface TimeSeriesPoint {
  bucket: string; // ISO date (day) or ISO week start
  avgWeightedScore: number | null;
  runs: number;
}

export async function getRunsTimeSeries(bucket: TimeBucket = 'day'): Promise<TimeSeriesPoint[]> {
  // Use SQLite date functions to bucket; returns 0–1 weighted scores
  const dateExpr = bucket === 'week' ? `strftime('%Y-%W-1', started_at)` : `date(started_at)`;
  const sql = `
    SELECT ${dateExpr} as bucket,
           AVG(weighted_score) as avgWeightedScore,
           COUNT(*) as runs
    FROM benchmark_runs
    WHERE weighted_score IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
  return query<TimeSeriesPoint>(sql);
}

export interface AgentModelStat {
  agent: string;
  model: string | null;
  avgScore: number | null;
  successRate: number; // 0–100
  avgCost: number | null;
  avgDuration: number | null;
  totalRuns: number;
}

export async function getAgentModelStats(): Promise<AgentModelStat[]> {
  const sql = `
    SELECT
      br.agent,
      br.model,
      AVG(br.weighted_score) as avgScore,
      CAST(SUM(CASE WHEN br.status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as successRate,
      AVG(rt.cost_usd) as avgCost,
      AVG(rt.duration_ms) as avgDuration,
      COUNT(*) as totalRuns
    FROM benchmark_runs br
    LEFT JOIN run_telemetry rt ON br.run_id = rt.run_id
    WHERE br.weighted_score IS NOT NULL
    GROUP BY br.agent, br.model
    ORDER BY avgScore DESC
  `;
  return query<AgentModelStat>(sql);
}
