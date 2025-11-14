import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { config } from 'dotenv';
import { SCHEMA } from './schema';

// Load environment variables from .env file in project root
// This matches the pattern used in other packages (harness, agent-adapters)
config({ path: resolve(process.cwd(), '.env') });

// Debug: Log relevant environment variables
if (process.env.ZE_BENCHMARKS_DB) {
  console.log(`[env] ZE_BENCHMARKS_DB=${process.env.ZE_BENCHMARKS_DB}`);
}


export interface RunStatistics {
  totalRuns: number;
  successfulRuns: number;
  averageScore: number;
  averageWeightedScore: number;
  averageDuration: number;
  successRate: number;
  evaluatorStats: Record<string, {
    averageScore: number;
    maxScore: number;
    count: number;
  }>;
}

export interface SuiteStatistics {
  totalRuns: number;
  successfulRuns: number;
  avgScore: number;
  avgWeightedScore: number;
  avgDuration: number;
  scenarioBreakdown: Array<{
    scenario: string;
    runs: number;
    avgScore: number;
  }>;
}

export interface ScenarioStatistics {
  totalRuns: number;
  successfulRuns: number;
  avgScore: number;
  avgWeightedScore: number;
  minScore: number;
  maxScore: number;
  agentComparison: Array<{
    agent: string;
    runs: number;
    avgScore: number;
  }>;
  tierBreakdown: Array<{
    tier: string;
    runs: number;
    avgScore: number;
  }>;
}

export interface DetailedRunStatistics {
  run: BenchmarkRun;
  evaluationBreakdown: Array<{
    name: string;
    score: number;
    maxScore: number;
    percentage: number;
  }>;
  telemetrySummary: {
    toolCalls: number;
    tokens: number;
    cost: number;
    duration: number;
  } | null;
}

export interface BenchmarkRun {
  id: number;
  runId: string;
  batchId?: string;
  suite: string;
  scenario: string;
  tier: string;
  agent: string;
  model?: string;
  status: 'running' | 'completed' | 'failed' | 'incomplete';
  startedAt: string;
  completedAt?: string;
  totalScore?: number | null;
  weightedScore?: number | null;
  packageManager?: string | null;
  testResults?: string | null;
  metadata?: string;
}

export interface EvaluationResult {
  id: number;
  runId: string;
  evaluatorName: string;
  score: number;
  maxScore: number;
  details?: string;
  createdAt: string;
}

export interface RunTelemetry {
  id: number;
  runId: string;
  toolCalls?: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  durationMs?: number;
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
  metadata?: string;
}

export interface BatchStatistics {
  batchId: string;
  createdAt: number;
  completedAt?: number;
  totalRuns: number;
  successfulRuns: number;
  avgScore: number;
  avgWeightedScore: number;
  duration: number;
  runs: BenchmarkRun[];
}

export class BenchmarkLogger {
  private static instance: BenchmarkLogger | null = null;
  private db: Database.Database;
  private currentRunId: string | null = null;

  constructor(dbPath?: string) {
    // Use absolute path to avoid working directory issues
    const defaultPath = join(process.cwd(), 'benchmark-report', 'public', 'benchmarks.db');
    const path = dbPath || process.env.ZE_BENCHMARKS_DB || defaultPath;
    
    console.log(`Database path: ${path}`);
    
    // Ensure directory exists
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.initializeSchema();
    
    // Ensure database is properly created and accessible
    this.ensureDatabaseExists();
  }

  static getInstance(dbPath?: string): BenchmarkLogger {
    if (!BenchmarkLogger.instance) {
      BenchmarkLogger.instance = new BenchmarkLogger(dbPath);
    }
    return BenchmarkLogger.instance;
  }

  private initializeSchema() {
    this.db.exec(SCHEMA);
    this.addBatchIdColumnIfNeeded();
    this.addSuccessTrackingColumnsIfNeeded();
    this.addPackageManagerAndTestResultsColumnsIfNeeded();
  }

  private addBatchIdColumnIfNeeded() {
    try {
      // Check if batchId column exists
      const columns = this.db.prepare("PRAGMA table_info(benchmark_runs)").all() as Array<{name: string}>;
      const hasBatchId = columns.some(col => col.name === 'batchId');
      
      if (!hasBatchId) {
        console.log('Adding batchId column to existing database...');
        this.db.exec('ALTER TABLE benchmark_runs ADD COLUMN batchId TEXT');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_runs_batchId ON benchmark_runs(batchId)');
        console.log('✓ batchId column added successfully');
      }
    } catch (error) {
      console.warn('Failed to add batchId column:', error);
    }
  }

  private addSuccessTrackingColumnsIfNeeded() {
    try {
      // Check if success tracking columns exist
      const columns = this.db.prepare("PRAGMA table_info(benchmark_runs)").all() as Array<{name: string}>;
      const hasIsSuccessful = columns.some(col => col.name === 'is_successful');
      const hasSuccessMetric = columns.some(col => col.name === 'success_metric');
      
      if (!hasIsSuccessful) {
        console.log('Adding is_successful column to existing database...');
        this.db.exec('ALTER TABLE benchmark_runs ADD COLUMN is_successful BOOLEAN DEFAULT 0');
        console.log('✓ is_successful column added successfully');
      }
      
      if (!hasSuccessMetric) {
        console.log('Adding success_metric column to existing database...');
        this.db.exec('ALTER TABLE benchmark_runs ADD COLUMN success_metric REAL');
        console.log('✓ success_metric column added successfully');
      }
      
      // Add index for is_successful if it doesn't exist
      try {
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_runs_is_successful ON benchmark_runs(is_successful)');
      } catch (error) {
        // Index might already exist, ignore error
      }
    } catch (error) {
      console.warn('Failed to add success tracking columns:', error);
    }
  }

  private addPackageManagerAndTestResultsColumnsIfNeeded() {
    try {
      const columns = this.db.prepare("PRAGMA table_info(benchmark_runs)").all() as Array<{name: string}>;
      const hasPackageManager = columns.some(col => col.name === 'package_manager');
      const hasTestResults = columns.some(col => col.name === 'test_results');
      
      if (!hasPackageManager) {
        console.log('Adding package_manager column to existing database...');
        this.db.exec('ALTER TABLE benchmark_runs ADD COLUMN package_manager TEXT');
        console.log('✓ package_manager column added successfully');
      }
      
      if (!hasTestResults) {
        console.log('Adding test_results column to existing database...');
        this.db.exec('ALTER TABLE benchmark_runs ADD COLUMN test_results TEXT');
        console.log('✓ test_results column added successfully');
      }
    } catch (error) {
      console.warn('Failed to add package manager and test results columns:', error);
    }
  }

  private updateTimestamp(): void {
    try {
      const versionFile = join(dirname(this.db.name), 'db-version.json');
      writeFileSync(versionFile, JSON.stringify({ 
        lastModified: Date.now() 
      }));
    } catch (error) {
      // Silently ignore timestamp update errors
    }
  }

  /**
   * Ensures the database file exists and is properly initialized
   * This method can be called to verify database creation
   */
  ensureDatabaseExists(): boolean {
    try {
      console.log(`Checking database at: ${this.db.name}`);
      console.log(`File exists: ${existsSync(this.db.name)}`);
      
      // Check if database file exists
      if (!existsSync(this.db.name)) {
        console.warn('Database file does not exist, creating new one...');
        mkdirSync(dirname(this.db.name), { recursive: true });
        this.db = new Database(this.db.name);
        this.initializeSchema();
        return true;
      }
      
      // Test database connection
      console.log('Testing database connection...');
      this.db.prepare('SELECT 1').get();
      console.log('✓ Database connection successful');
      return true;
    } catch (error) {
      console.error('Failed to ensure database exists:', error);
      return false;
    }
  }

  /**
   * Public method to create the database file explicitly
   * This can be called from CLI or other parts of the system
   */
  createDatabase(): boolean {
    try {
      console.log(`Creating database at: ${this.db.name}`);
      mkdirSync(dirname(this.db.name), { recursive: true });
      
      // Create a new database instance
      this.db = new Database(this.db.name);
      this.initializeSchema();
      
      // Update timestamp to indicate database creation
      this.updateTimestamp();
      
      console.log('✓ Database created successfully');
      return true;
    } catch (error) {
      console.error('Failed to create database:', error);
      return false;
    }
  }

  startRun(suite: string, scenario: string, tier: string, agent: string, model?: string, batchId?: string): string {
    const runId = uuidv4();
    this.currentRunId = runId;

    this.db.prepare(`
      INSERT INTO benchmark_runs (run_id, batchId, suite, scenario, tier, agent, model, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'running')
    `).run(runId, batchId, suite, scenario, tier, agent, model);

    return runId;
  }

  completeRun(totalScore?: number, weightedScore?: number, metadata?: Record<string, any>, isSuccessful?: boolean, successMetric?: number, packageManager?: string, testResults?: string) {
    if (!this.currentRunId) throw new Error('No active run');
    
    this.db.prepare(`
      UPDATE benchmark_runs 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP, total_score = ?, weighted_score = ?, is_successful = ?, success_metric = ?, package_manager = ?, test_results = ?, metadata = ?
      WHERE run_id = ?
    `).run(totalScore, weightedScore, isSuccessful ? 1 : 0, successMetric, packageManager, testResults, JSON.stringify(metadata), this.currentRunId);
    
    this.updateTimestamp();
  }

  markRunIncomplete(reason?: string, stage?: string) {
    if (!this.currentRunId) throw new Error('No active run');
    this.db.prepare(`
      UPDATE benchmark_runs 
      SET status = 'incomplete', completed_at = CURRENT_TIMESTAMP, metadata = ?
      WHERE run_id = ?
    `).run(JSON.stringify({ reason: reason || 'Run interrupted', stage: stage || 'unknown', incomplete: true }), this.currentRunId);
    this.updateTimestamp();
  }

  failRun(error: string, errorType?: 'workspace' | 'prompt' | 'agent' | 'evaluation' | 'unknown') {
    if (!this.currentRunId) throw new Error('No active run');
    
    this.db.prepare(`
      UPDATE benchmark_runs 
      SET status = 'failed', completed_at = CURRENT_TIMESTAMP, metadata = ?
      WHERE run_id = ?
    `).run(JSON.stringify({ error, errorType: errorType || 'unknown' }), this.currentRunId);
    
    this.updateTimestamp();
  }

  logEvaluation(evaluatorName: string, score: number, maxScore: number, details?: string) {
    if (!this.currentRunId) throw new Error('No active run');
    
    this.db.prepare(`
      INSERT INTO evaluation_results (run_id, evaluator_name, score, max_score, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(this.currentRunId, evaluatorName, score, maxScore, details);
    
    this.updateTimestamp();
  }

  logTelemetry(toolCalls?: number, tokensIn?: number, tokensOut?: number, costUsd?: number, durationMs?: number, workspaceDir?: string) {
    if (!this.currentRunId) throw new Error('No active run');
    
    this.db.prepare(`
      INSERT INTO run_telemetry (run_id, tool_calls, tokens_in, tokens_out, cost_usd, duration_ms, workspace_dir)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(this.currentRunId, toolCalls, tokensIn, tokensOut, costUsd, durationMs, workspaceDir);
  }

  getRunHistory(limit: number = 50): BenchmarkRun[] {
    const rows = this.db.prepare(`
      SELECT 
        id,
        run_id as runId,
        suite,
        scenario,
        tier,
        agent,
        model,
        status,
        started_at as startedAt,
        completed_at as completedAt,
        total_score as totalScore,
        weighted_score as weightedScore,
        package_manager as packageManager,
        test_results as testResults,
        metadata
      FROM benchmark_runs 
      ORDER BY started_at DESC 
      LIMIT ?
    `).all(limit) as any[];
    
    return rows.map(row => ({
      id: row.id,
      runId: row.runId,
      suite: row.suite,
      scenario: row.scenario,
      tier: row.tier,
      agent: row.agent,
      model: row.model,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      totalScore: row.totalScore,
      weightedScore: row.weightedScore,
      packageManager: row.packageManager,
      testResults: row.testResults,
      metadata: row.metadata
    }));
  }

  getRunDetails(runId: string) {
    const runRow = this.db.prepare(`
      SELECT 
        id,
        run_id as runId,
        suite,
        scenario,
        tier,
        agent,
        model,
        status,
        started_at as startedAt,
        completed_at as completedAt,
        total_score as totalScore,
        weighted_score as weightedScore,
        package_manager as packageManager,
        test_results as testResults,
        metadata
      FROM benchmark_runs WHERE run_id = ?
    `).get(runId) as any;
    
    const run: BenchmarkRun | undefined = runRow ? {
      id: runRow.id,
      runId: runRow.runId,
      suite: runRow.suite,
      scenario: runRow.scenario,
      tier: runRow.tier,
      agent: runRow.agent,
      model: runRow.model,
      status: runRow.status,
      startedAt: runRow.startedAt,
      completedAt: runRow.completedAt,
      totalScore: runRow.totalScore,
      weightedScore: runRow.weightedScore,
      packageManager: runRow.packageManager,
      testResults: runRow.testResults,
      metadata: runRow.metadata
    } : undefined;
    
    const evaluationRows = this.db.prepare(`
      SELECT 
        id,
        run_id as runId,
        evaluator_name as evaluatorName,
        score,
        max_score as maxScore,
        details,
        created_at as createdAt
      FROM evaluation_results WHERE run_id = ?
    `).all(runId) as any[];
    
    const evaluations: EvaluationResult[] = evaluationRows.map(row => ({
      id: row.id,
      runId: row.runId,
      evaluatorName: row.evaluatorName,
      score: row.score,
      maxScore: row.maxScore,
      details: row.details,
      createdAt: row.createdAt
    }));
    
    const telemetryRows = this.db.prepare(`
      SELECT 
        id,
        run_id as runId,
        tool_calls as toolCalls,
        tokens_in as tokensIn,
        tokens_out as tokensOut,
        cost_usd as costUsd,
        duration_ms as durationMs,
        workspace_dir as workspaceDir
      FROM run_telemetry WHERE run_id = ?
    `).all(runId) as any[];
    
    const telemetry: RunTelemetry[] = telemetryRows.map(row => ({
      id: row.id,
      runId: row.runId,
      toolCalls: row.toolCalls,
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      costUsd: row.costUsd,
      durationMs: row.durationMs,
      workspaceDir: row.workspaceDir
    }));
    
    return { run, evaluations, telemetry };
  }

  getStats(filters?: { suite?: string; scenario?: string; agent?: string; days?: number }): RunStatistics {
    let whereClause = "WHERE status = 'completed' AND is_successful = 1";
    const params: any[] = [];

    if (filters?.suite) {
      whereClause += " AND suite = ?";
      params.push(filters.suite);
    }
    if (filters?.scenario) {
      whereClause += " AND scenario = ?";
      params.push(filters.scenario);
    }
    if (filters?.agent) {
      whereClause += " AND agent = ?";
      params.push(filters.agent);
    }
    if (filters?.days) {
      whereClause += " AND started_at >= datetime('now', '-? days')";
      params.push(filters.days);
    }

    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as totalRuns,
        AVG(total_score) as averageScore,
        AVG(weighted_score) as averageWeightedScore,
        AVG((julianday(completed_at) - julianday(started_at)) * 24 * 60 * 60 * 1000) as averageDuration
      FROM benchmark_runs 
      ${whereClause}
    `).get(...params) as any;

    const successfulRuns = this.db.prepare(`
      SELECT COUNT(*) as count FROM benchmark_runs 
      ${whereClause}
    `).get(...params) as any;

    // Get evaluator statistics
    const evaluatorStats = this.db.prepare(`
      SELECT 
        evaluator_name,
        AVG(score) as averageScore,
        MAX(max_score) as maxScore,
        COUNT(*) as count
      FROM evaluation_results er
      JOIN benchmark_runs br ON er.run_id = br.run_id
      ${whereClause.replace('benchmark_runs', 'br')}
      GROUP BY evaluator_name
    `).all(...params) as any[];

    const evaluatorStatsMap: Record<string, any> = {};
    evaluatorStats.forEach(stat => {
      evaluatorStatsMap[stat.evaluator_name] = {
        averageScore: stat.averageScore,
        maxScore: stat.maxScore,
        count: stat.count
      };
    });

    return {
      totalRuns: stats.totalRuns || 0,
      successfulRuns: successfulRuns.count || 0,
      averageScore: stats.averageScore || 0,
      averageWeightedScore: stats.averageWeightedScore || 0,
      averageDuration: stats.averageDuration || 0,
      successRate: stats.totalRuns > 0 ? (successfulRuns.count / stats.totalRuns) : 0,
      evaluatorStats: evaluatorStatsMap
    };
  }

  getAverageScoresByAgent(limit: number = 100) {
    return this.db.prepare(`
      SELECT agent, AVG(weighted_score) as avg_score, COUNT(*) as run_count
      FROM benchmark_runs 
      WHERE status = 'completed' AND is_successful = 1 AND weighted_score IS NOT NULL
      GROUP BY agent
      ORDER BY avg_score DESC
      LIMIT ?
    `).all(limit);
  }

  getModelPerformanceStats() {
    return this.db.prepare(`
      SELECT 
        model,
        COUNT(*) as runs,
        AVG(weighted_score) as avgScore,
        MIN(weighted_score) as minScore,
        MAX(weighted_score) as maxScore
      FROM benchmark_runs 
      WHERE status = 'completed' AND is_successful = 1 AND model IS NOT NULL AND model != 'default'
      GROUP BY model
      ORDER BY avgScore DESC
    `).all() as any[];
  }

  getEvaluationTrends(evaluatorName: string, days: number = 30) {
    return this.db.prepare(`
      SELECT DATE(created_at) as date, AVG(score) as avg_score, COUNT(*) as count
      FROM evaluation_results 
      WHERE evaluator_name = ? AND created_at >= datetime('now', '-? days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(evaluatorName, days);
  }

  getSuiteStats(suite: string): SuiteStatistics {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as totalRuns,
        COUNT(CASE WHEN status = 'completed' AND is_successful = 1 THEN 1 END) as successfulRuns,
        AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN total_score END) as avgScore,
        AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as avgWeightedScore,
        AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN 
          (julianday(completed_at) - julianday(started_at)) * 24 * 60 * 60 * 1000 
        END) as avgDuration
      FROM benchmark_runs 
      WHERE suite = ?
    `).get(suite) as any;

    // Get scenario breakdown
    const scenarioBreakdown = this.db.prepare(`
      SELECT 
        scenario,
        COUNT(*) as runs,
        AVG(total_score) as avgScore
      FROM benchmark_runs 
      WHERE suite = ? AND status = 'completed' AND is_successful = 1
      GROUP BY scenario
    `).all(suite) as any[];

    return {
      totalRuns: stats.totalRuns || 0,
      successfulRuns: stats.successfulRuns || 0,
      avgScore: stats.avgScore || 0,
      avgWeightedScore: stats.avgWeightedScore || 0,
      avgDuration: stats.avgDuration || 0,
      scenarioBreakdown: scenarioBreakdown.map(row => ({
        scenario: row.scenario,
        runs: row.runs,
        avgScore: row.avgScore || 0
      }))
    };
  }

  getScenarioStats(suite: string, scenario: string): ScenarioStatistics {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as totalRuns,
        COUNT(CASE WHEN status = 'completed' AND is_successful = 1 THEN 1 END) as successfulRuns,
        AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN total_score END) as avgScore,
        AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as avgWeightedScore,
        MIN(weighted_score) as minScore,
        MAX(weighted_score) as maxScore
      FROM benchmark_runs 
      WHERE suite = ? AND scenario = ?
    `).get(suite, scenario) as any;

    // Get agent comparison for this scenario
    const agentComparison = this.db.prepare(`
      SELECT 
        agent,
        COUNT(*) as runs,
        AVG(total_score) as avgScore
      FROM benchmark_runs 
      WHERE suite = ? AND scenario = ? AND status = 'completed' AND is_successful = 1
      GROUP BY agent
      ORDER BY avgScore DESC
    `).all(suite, scenario) as any[];

    // Get tier breakdown
    const tierBreakdown = this.db.prepare(`
      SELECT 
        tier,
        COUNT(*) as runs,
        AVG(total_score) as avgScore
      FROM benchmark_runs 
      WHERE suite = ? AND scenario = ? AND status = 'completed' AND is_successful = 1
      GROUP BY tier
    `).all(suite, scenario) as any[];

    return {
      totalRuns: stats.totalRuns || 0,
      successfulRuns: stats.successfulRuns || 0,
      avgScore: stats.avgScore || 0,
      avgWeightedScore: stats.avgWeightedScore || 0,
      minScore: stats.minScore || 0,
      maxScore: stats.maxScore || 0,
      agentComparison: agentComparison.map(row => ({
        agent: row.agent,
        runs: row.runs,
        avgScore: row.avgScore || 0
      })),
      tierBreakdown: tierBreakdown.map(row => ({
        tier: row.tier,
        runs: row.runs,
        avgScore: row.avgScore || 0
      }))
    };
  }

  getDetailedRunStats(runId: string): DetailedRunStatistics {
    const run = this.getRunDetails(runId);
    
    // Calculate evaluation breakdown
    const evaluationBreakdown = run.evaluations.map(e => ({
      name: e.evaluatorName,
      score: e.score,
      maxScore: e.maxScore,
      percentage: (e.score / e.maxScore) * 100
    }));

    // Get telemetry summary
    const telemetrySummary = run.telemetry.length > 0 ? {
      toolCalls: run.telemetry[0].toolCalls || 0,
      tokens: (run.telemetry[0].tokensIn || 0) + (run.telemetry[0].tokensOut || 0),
      cost: run.telemetry[0].costUsd || 0,
      duration: run.telemetry[0].durationMs || 0
    } : null;

    return {
      run: run.run!,
      evaluationBreakdown,
      telemetrySummary
    };
  }

  startBatch(): string {
    const batchId = uuidv4();
    const now = Date.now();
    
    this.db.prepare(`
      INSERT INTO batch_runs (batchId, createdAt, totalRuns, successfulRuns)
      VALUES (?, ?, 0, 0)
    `).run(batchId, now);
    
    return batchId;
  }

  getBatchSuccessfulRunsCount(batchId: string): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM benchmark_runs 
      WHERE batchId = ? AND status = 'completed' AND is_successful = 1
    `).get(batchId) as any;
    
    return result.count || 0;
  }

  getBatchScoreStats(batchId: string): { avgScore: number; avgWeightedScore: number } {
    const result = this.db.prepare(`
      SELECT 
        AVG(total_score) as avgScore,
        AVG(weighted_score) as avgWeightedScore
      FROM benchmark_runs 
      WHERE batchId = ? AND status = 'completed' AND is_successful = 1
    `).get(batchId) as any;
    
    return {
      avgScore: result.avgScore || 0,
      avgWeightedScore: result.avgWeightedScore || 0
    };
  }

  completeBatch(batchId: string, summary: {
    totalRuns: number;
    successfulRuns: number;
    avgScore: number;
    avgWeightedScore: number;
    metadata?: Record<string, any>;
  }) {
    const now = Date.now();
    
    this.db.prepare(`
      UPDATE batch_runs 
      SET completedAt = ?, totalRuns = ?, successfulRuns = ?, avgScore = ?, avgWeightedScore = ?, metadata = ?
      WHERE batchId = ?
    `).run(now, summary.totalRuns, summary.successfulRuns, summary.avgScore, summary.avgWeightedScore, 
           JSON.stringify(summary.metadata), batchId);
    
    this.updateTimestamp();
  }

  getBatchHistory(limit: number = 20): BatchRun[] {
    const rows = this.db.prepare(`
      SELECT 
        batchId,
        createdAt,
        completedAt,
        totalRuns,
        successfulRuns,
        avgScore,
        avgWeightedScore,
        metadata
      FROM batch_runs 
      ORDER BY createdAt DESC 
      LIMIT ?
    `).all(limit) as any[];
    
    return rows.map(row => ({
      batchId: row.batchId,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      totalRuns: row.totalRuns,
      successfulRuns: row.successfulRuns,
      avgScore: row.avgScore,
      avgWeightedScore: row.avgWeightedScore,
      metadata: row.metadata
    }));
  }

  getBatchDetails(batchId: string): BatchStatistics | null {
    const batchRow = this.db.prepare(`
      SELECT 
        batchId,
        createdAt,
        completedAt,
        totalRuns,
        successfulRuns,
        avgScore,
        avgWeightedScore
      FROM batch_runs WHERE batchId = ?
    `).get(batchId) as any;
    
    if (!batchRow) return null;
    
    const runs = this.db.prepare(`
      SELECT 
        id,
        run_id as runId,
        batchId,
        suite,
        scenario,
        tier,
        agent,
        model,
        status,
        started_at as startedAt,
        completed_at as completedAt,
        total_score as totalScore,
        weighted_score as weightedScore,
        metadata
      FROM benchmark_runs 
      WHERE batchId = ?
      ORDER BY started_at
    `).all(batchId) as any[];
    
    const duration = batchRow.completedAt ? batchRow.completedAt - batchRow.createdAt : 0;
    
    return {
      batchId: batchRow.batchId,
      createdAt: batchRow.createdAt,
      completedAt: batchRow.completedAt,
      totalRuns: batchRow.totalRuns,
      successfulRuns: batchRow.successfulRuns,
      avgScore: batchRow.avgScore || 0,
      avgWeightedScore: batchRow.avgWeightedScore || 0,
      duration,
      runs: runs.map(run => ({
        id: run.id,
        runId: run.runId,
        batchId: run.batchId,
        suite: run.suite,
        scenario: run.scenario,
        tier: run.tier,
        agent: run.agent,
        model: run.model,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        totalScore: run.totalScore,
        weightedScore: run.weightedScore,
        metadata: run.metadata
      }))
    };
  }

  getBatchComparison(batchIds: string[]): BatchStatistics[] {
    const placeholders = batchIds.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT 
        batchId,
        createdAt,
        completedAt,
        totalRuns,
        successfulRuns,
        avgScore,
        avgWeightedScore
      FROM batch_runs 
      WHERE batchId IN (${placeholders})
      ORDER BY createdAt DESC
    `).all(...batchIds) as any[];
    
    return rows.map(row => {
      const duration = row.completedAt ? row.completedAt - row.createdAt : 0;
      return {
        batchId: row.batchId,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
        totalRuns: row.totalRuns,
        successfulRuns: row.successfulRuns,
        avgScore: row.avgScore || 0,
        avgWeightedScore: row.avgWeightedScore || 0,
        duration,
        runs: [] // Will be populated if needed
      };
    });
  }

  getBatchAnalytics(batchId: string) {
    const batch = this.getBatchDetails(batchId);
    if (!batch) return null;

    // Suite/scenario breakdown
    const suiteBreakdown = this.db.prepare(`
      SELECT 
        suite,
        scenario,
        COUNT(*) as runs,
        COUNT(CASE WHEN status = 'completed' AND is_successful = 1 THEN 1 END) as successfulRuns,
        AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN total_score END) as avgScore,
        AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as avgWeightedScore
      FROM benchmark_runs 
      WHERE batchId = ?
      GROUP BY suite, scenario
      ORDER BY suite, scenario
    `).all(batchId) as any[];

    // Agent performance comparison
    const agentPerformance = this.db.prepare(`
      SELECT 
        agent,
        model,
        COUNT(*) as runs,
        COUNT(CASE WHEN status = 'completed' AND is_successful = 1 THEN 1 END) as successfulRuns,
        AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as avgWeightedScore,
        MIN(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as minScore,
        MAX(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as maxScore
      FROM benchmark_runs 
      WHERE batchId = ?
      GROUP BY agent, model
      ORDER BY avgWeightedScore DESC
    `).all(batchId) as any[];

    // Tier distribution
    const tierDistribution = this.db.prepare(`
      SELECT 
        tier,
        COUNT(*) as runs,
        COUNT(CASE WHEN status = 'completed' AND is_successful = 1 THEN 1 END) as successfulRuns,
        AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as avgWeightedScore
      FROM benchmark_runs 
      WHERE batchId = ?
      GROUP BY tier
      ORDER BY tier
    `).all(batchId) as any[];

    // Evaluator score breakdown
    const evaluatorBreakdown = this.db.prepare(`
      SELECT 
        er.evaluator_name as evaluatorName,
        AVG(er.score) as avgScore,
        MAX(er.max_score) as maxScore,
        COUNT(*) as count
      FROM evaluation_results er
      JOIN benchmark_runs br ON er.run_id = br.run_id
      WHERE br.batchId = ? AND br.status = 'completed' AND br.is_successful = 1
      GROUP BY er.evaluator_name
      ORDER BY avgScore DESC
    `).all(batchId) as any[];

    // Failed runs details
    const failedRuns = this.db.prepare(`
      SELECT 
        run_id as runId,
        suite,
        scenario,
        tier,
        agent,
        model,
        metadata
      FROM benchmark_runs 
      WHERE batchId = ? AND status = 'failed'
      ORDER BY started_at
    `).all(batchId) as any[];

    return {
      batch,
      suiteBreakdown: suiteBreakdown.map(row => ({
        suite: row.suite,
        scenario: row.scenario,
        runs: row.runs,
        successfulRuns: row.successfulRuns,
        avgScore: row.avgScore || 0,
        avgWeightedScore: row.avgWeightedScore || 0
      })),
      agentPerformance: agentPerformance.map(row => ({
        agent: row.agent,
        model: row.model,
        runs: row.runs,
        successfulRuns: row.successfulRuns,
        avgWeightedScore: row.avgWeightedScore || 0,
        minScore: row.minScore || 0,
        maxScore: row.maxScore || 0
      })),
      tierDistribution: tierDistribution.map(row => ({
        tier: row.tier,
        runs: row.runs,
        successfulRuns: row.successfulRuns,
        avgWeightedScore: row.avgWeightedScore || 0
      })),
      evaluatorBreakdown: evaluatorBreakdown.map(row => ({
        evaluatorName: row.evaluatorName,
        avgScore: row.avgScore || 0,
        maxScore: row.maxScore || 1,
        count: row.count
      })),
      failedRuns: failedRuns.map(row => ({
        runId: row.runId,
        suite: row.suite,
        scenario: row.scenario,
        tier: row.tier,
        agent: row.agent,
        model: row.model,
        error: row.metadata ? JSON.parse(row.metadata).error : null
      }))
    };
  }

  getAllBatches(filters?: {
    limit?: number;
    status?: 'completed' | 'running';
    sortBy?: 'date' | 'score';
  }) {
    const limit = filters?.limit || 50;
    const sortBy = filters?.sortBy || 'date';
    
    let whereClause = '';
    if (filters?.status === 'completed') {
      whereClause = 'WHERE completedAt IS NOT NULL';
    } else if (filters?.status === 'running') {
      whereClause = 'WHERE completedAt IS NULL';
    }

    const orderBy = sortBy === 'score' 
      ? 'ORDER BY avgWeightedScore DESC, createdAt DESC'
      : 'ORDER BY createdAt DESC';

    const rows = this.db.prepare(`
      SELECT 
        batchId,
        createdAt,
        completedAt,
        totalRuns,
        successfulRuns,
        avgScore,
        avgWeightedScore,
        metadata
      FROM batch_runs 
      ${whereClause}
      ${orderBy}
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => ({
      batchId: row.batchId,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      totalRuns: row.totalRuns,
      successfulRuns: row.successfulRuns,
      avgScore: row.avgScore,
      avgWeightedScore: row.avgWeightedScore,
      metadata: row.metadata,
      duration: row.completedAt ? row.completedAt - row.createdAt : null
    }));
  }

  getBatchTrends(days: number = 30) {
    const rows = this.db.prepare(`
      SELECT 
        DATE(createdAt / 1000, 'unixepoch') as date,
        COUNT(*) as batchCount,
        AVG(avgWeightedScore) as avgScore,
        AVG(CAST(successfulRuns AS REAL) / CAST(totalRuns AS REAL)) as avgSuccessRate
      FROM batch_runs 
      WHERE createdAt >= ?
        AND completedAt IS NOT NULL
      GROUP BY DATE(createdAt / 1000, 'unixepoch')
      ORDER BY date
    `).all(Date.now() - (days * 24 * 60 * 60 * 1000)) as any[];

    return rows.map(row => ({
      date: row.date,
      batchCount: row.batchCount,
      avgScore: row.avgScore || 0,
      avgSuccessRate: row.avgSuccessRate || 0
    }));
  }

  getFailureBreakdown(batchId: string): { errorType: string, count: number }[] {
    const rows = this.db.prepare(`
      SELECT 
        JSON_EXTRACT(metadata, '$.errorType') as errorType,
        COUNT(*) as count
      FROM benchmark_runs 
      WHERE batchId = ? AND status = 'failed'
      GROUP BY errorType
      ORDER BY count DESC
    `).all(batchId) as any[];

    return rows.map(row => ({
      errorType: row.errorType || 'unknown',
      count: row.count
    }));
  }

  clearDatabase() {
    this.db.exec('DELETE FROM run_telemetry');
    this.db.exec('DELETE FROM evaluation_results');
    this.db.exec('DELETE FROM benchmark_runs');
    this.db.exec('DELETE FROM batch_runs');
  }

  close() {
    this.db.close();
    BenchmarkLogger.instance = null;
  }
}
