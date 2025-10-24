export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS batch_runs (
    batchId TEXT PRIMARY KEY,
    createdAt INTEGER NOT NULL,
    completedAt INTEGER,
    totalRuns INTEGER DEFAULT 0,
    successfulRuns INTEGER DEFAULT 0,
    avgScore REAL,
    avgWeightedScore REAL,
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS benchmark_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT UNIQUE NOT NULL,
    batchId TEXT,
    suite TEXT NOT NULL,
    scenario TEXT NOT NULL,
    tier TEXT NOT NULL,
    agent TEXT NOT NULL,
    model TEXT,
    status TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    total_score REAL,
    weighted_score REAL,
    metadata TEXT,
    FOREIGN KEY (batchId) REFERENCES batch_runs(batchId)
  );

  CREATE TABLE IF NOT EXISTS evaluation_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    evaluator_name TEXT NOT NULL,
    score REAL NOT NULL,
    max_score REAL NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES benchmark_runs(run_id)
  );

  CREATE TABLE IF NOT EXISTS run_telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    tool_calls INTEGER,
    tokens_in INTEGER,
    tokens_out INTEGER,
    cost_usd REAL,
    duration_ms INTEGER,
    workspace_dir TEXT,
    FOREIGN KEY (run_id) REFERENCES benchmark_runs(run_id)
  );

  CREATE INDEX IF NOT EXISTS idx_runs_suite_scenario ON benchmark_runs(suite, scenario);
  CREATE INDEX IF NOT EXISTS idx_runs_agent ON benchmark_runs(agent);
  CREATE INDEX IF NOT EXISTS idx_runs_status ON benchmark_runs(status);
  CREATE INDEX IF NOT EXISTS idx_runs_batchId ON benchmark_runs(batchId);
  CREATE INDEX IF NOT EXISTS idx_evals_run_id ON evaluation_results(run_id);
`;
