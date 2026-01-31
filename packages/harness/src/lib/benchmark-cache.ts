import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '@ze/logger';

const log = logger.benchmarkCache;

export interface CachedBenchmarkRun {
  runId: string;
  batchId: string;
  suite: string;
  scenario: string;
  tier: string;
  agent: string;
  model: string;
  status: 'completed' | 'failed';
  startedAt: string;
  completedAt: string;
  totalScore?: number;
  weightedScore?: number;
  isSuccessful?: boolean;
  specialistEnabled?: boolean;
  telemetry?: {
    toolCalls?: number;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
    durationMs?: number;
  };
  evaluations?: Array<{
    evaluatorName: string;
    score: number;
    maxScore: number;
    details?: string;
  }>;
}

export interface BenchmarkCache {
  batchId: string;
  runs: CachedBenchmarkRun[];
  created: string;
  updated: string;
}

/**
 * Get cache directory path
 */
export function getCacheDir(): string {
  return join(process.cwd(), '.benchmark-cache');
}

/**
 * Get cache file path for a batch
 */
export function getCacheFilePath(batchId: string): string {
  return join(getCacheDir(), `${batchId}.json`);
}

/**
 * Initialize cache file for a batch
 */
export function initBenchmarkCache(batchId: string): void {
  try {
    const cacheDir = getCacheDir();

    // Create .benchmark-cache directory if it doesn't exist
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
      log.debug(`Created benchmark cache directory: ${cacheDir}`);
    }

    const cachePath = getCacheFilePath(batchId);

    // Initialize empty cache if file doesn't exist
    if (!existsSync(cachePath)) {
      const initialCache: BenchmarkCache = {
        batchId,
        runs: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      writeFileSync(cachePath, JSON.stringify(initialCache, null, 2), 'utf-8');
      log.debug(`Initialized benchmark cache: ${cachePath}`);
    }
  } catch (error) {
    log.warn(`Failed to initialize benchmark cache: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Add a benchmark run to the cache
 */
export function addRunToCache(run: CachedBenchmarkRun): void {
  try {
    const cachePath = getCacheFilePath(run.batchId);

    // Read existing cache
    let cache: BenchmarkCache;
    if (existsSync(cachePath)) {
      const content = readFileSync(cachePath, 'utf-8');
      cache = JSON.parse(content);
    } else {
      // Initialize if doesn't exist
      cache = {
        batchId: run.batchId,
        runs: [],
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };
    }

    // Add run to cache
    cache.runs.push(run);
    cache.updated = new Date().toISOString();

    // Write back
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');

    log.debug(`Added run ${run.runId} to cache (${cache.runs.length} total runs)`);
  } catch (error) {
    log.warn(`Failed to add run to cache: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Read benchmark cache for a batch
 */
export function readBenchmarkCache(batchId: string): BenchmarkCache | null {
  try {
    const cachePath = getCacheFilePath(batchId);

    if (!existsSync(cachePath)) {
      log.debug(`No cache found for batch: ${batchId}`);
      return null;
    }

    const content = readFileSync(cachePath, 'utf-8');
    const cache: BenchmarkCache = JSON.parse(content);

    log.debug(`Loaded ${cache.runs.length} run(s) from cache for batch ${batchId}`);
    return cache;
  } catch (error) {
    log.warn(`Failed to read benchmark cache: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Check if cache exists for a batch
 */
export function hasCachedBenchmarks(batchId: string): boolean {
  return existsSync(getCacheFilePath(batchId));
}
