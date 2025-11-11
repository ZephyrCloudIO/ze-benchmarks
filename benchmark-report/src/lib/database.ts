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
      // Try multiple paths to find the WASM file (handles different build setups)
      const SQL = await initSqlJs({
        locateFile: (file) => {
          // Try absolute path first (from public directory)
          if (file.endsWith('.wasm')) {
            return '/sql-wasm.wasm';
          }
          return file;
        },
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
      console.error('Failed to initialize sql.js:', error);
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
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  total_score?: number;
  weighted_score?: number;
  is_successful?: boolean;
  success_metric?: number;
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
