import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findZeBenchmarksRoot } from './project-root.js';

export interface BenchmarkConfig {
  suitesDir: string;
  outputDir: string;
  databasePath: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: BenchmarkConfig = {
  suitesDir: './suites',
  outputDir: './results',
  databasePath: './benchmarks.db',
};

/**
 * Load benchmark configuration from benchmark.config.json
 * Falls back to defaults if config file is not found
 *
 * @param projectRoot - The project root directory (if not provided, will be auto-detected)
 * @returns Benchmark configuration with absolute paths
 */
export function loadBenchmarkConfig(projectRoot?: string): BenchmarkConfig {
  // Auto-detect project root if not provided
  const root = projectRoot || findZeBenchmarksRoot();

  if (!root) {
    throw new Error(
      'Could not find ze-benchmarks project root. ' +
      'Make sure you are running from within the ze-benchmarks directory, ' +
      'or that benchmark.config.json exists in your project root.'
    );
  }

  // Try to load config file
  const configPath = join(root, 'benchmark.config.json');
  let config: Partial<BenchmarkConfig> = {};

  if (existsSync(configPath)) {
    try {
      const configContent = readFileSync(configPath, 'utf-8');
      config = JSON.parse(configContent);
    } catch (error) {
      console.warn(`Failed to parse benchmark.config.json: ${error instanceof Error ? error.message : String(error)}`);
      console.warn('Using default configuration');
    }
  }

  // Merge with defaults
  const mergedConfig: BenchmarkConfig = {
    suitesDir: config.suitesDir || DEFAULT_CONFIG.suitesDir,
    outputDir: config.outputDir || DEFAULT_CONFIG.outputDir,
    databasePath: config.databasePath || DEFAULT_CONFIG.databasePath,
  };

  // Resolve all paths relative to project root
  return {
    suitesDir: resolve(root, mergedConfig.suitesDir),
    outputDir: resolve(root, mergedConfig.outputDir),
    databasePath: resolve(root, mergedConfig.databasePath),
  };
}

/**
 * Get database path from environment variable or config
 * Priority: BENCHMARK_DB_PATH env var > config > default
 */
export function getDatabasePath(projectRoot?: string): string {
  if (process.env.BENCHMARK_DB_PATH) {
    return resolve(process.env.BENCHMARK_DB_PATH);
  }

  const config = loadBenchmarkConfig(projectRoot);
  return config.databasePath;
}
