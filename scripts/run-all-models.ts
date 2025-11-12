#!/usr/bin/env tsx
/**
 * Run benchmarks for all models defined in models.json5
 *
 * This script:
 * 1. Reads models.json5 from the workspace root
 * 2. Runs benchmarks for each vanilla and specialist model
 * 3. Organizes results into batches for easy comparison
 * 4. Stores results in benchmarks.db for visualization
 *
 * Usage:
 *   pnpm bench:run <suite> <scenario> [--tier L0]
 *
 * Examples:
 *   pnpm bench:run shadcn-generate-vite shadcn-generate-vite
 *   pnpm bench:run shadcn-generate-vite shadcn-generate-vite --tier L1
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { BenchmarkLogger } from '../packages/database/src/logger';
import { spinner } from '@clack/prompts';
import { executeWarmup } from '../packages/harness/src/domain/warmup';
import { loadScenario } from '../packages/harness/src/domain/scenario';
import { createAgentAdapter } from '../packages/harness/src/domain/agent';

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ModelConfig {
  provider: string;
  model: string;
  specialist?: string;
}

interface ModelsConfig {
  vanilla_models: ModelConfig[];
  specialist_models: ModelConfig[];
}

interface RunOptions {
  suite: string;
  scenario: string;
  tier: string;
  modelsConfigPath?: string;
}

function parseArgs(): RunOptions {
  let args = process.argv.slice(2);

  // Skip '--' if it's the first argument (pnpm passes it as separator)
  if (args[0] === '--') {
    args = args.slice(1);
  }

  if (args.length < 2) {
    console.error(chalk.red('❌ Error: Missing required arguments'));
    console.log('\n' + chalk.bold('Usage:'));
    console.log(`  ${chalk.cyan('pnpm bench:run')} <suite> <scenario> [options]`);
    console.log('\n' + chalk.bold('Options:'));
    console.log(`  ${chalk.cyan('--tier')} <tier>                Difficulty tier (default: L0)`);
    console.log(`  ${chalk.cyan('--models-config')} <path>      Path to models.json5 (default: ../../models.json5)`);
    console.log('\n' + chalk.bold('Examples:'));
    console.log(`  ${chalk.gray('pnpm bench:run shadcn-generate-vite shadcn-generate-vite')}`);
    console.log(`  ${chalk.gray('pnpm bench:run shadcn-generate-vite shadcn-generate-vite --tier L1')}`);
    process.exit(1);
  }

  const suite = args[0];
  const scenario = args[1];

  let tier = 'L0';
  let modelsConfigPath: string | undefined;

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--tier' && args[i + 1]) {
      tier = args[i + 1];
      i++;
    } else if (args[i] === '--models-config' && args[i + 1]) {
      modelsConfigPath = args[i + 1];
      i++;
    }
  }

  return { suite, scenario, tier, modelsConfigPath };
}

function loadModelsConfig(configPath?: string): ModelsConfig {
  const defaultPath = resolve(__dirname, '../../models.json5');
  const path = configPath ? resolve(configPath) : defaultPath;

  if (!existsSync(path)) {
    throw new Error(`Models config not found at: ${path}`);
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const config = JSON5.parse(content) as ModelsConfig;

    if (!config.vanilla_models || !Array.isArray(config.vanilla_models)) {
      throw new Error('Invalid models config: missing or invalid vanilla_models');
    }

    if (!config.specialist_models || !Array.isArray(config.specialist_models)) {
      throw new Error('Invalid models config: missing or invalid specialist_models');
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to load models config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function getAgentFromProvider(provider: string): string {
  const agentMap: Record<string, string> = {
    'anthropic': 'anthropic',
    'openai': 'openrouter',
    'openrouter': 'openrouter'
  };

  return agentMap[provider.toLowerCase()] || 'openrouter';
}

async function runBenchmark(
  suite: string,
  scenario: string,
  tier: string,
  model: ModelConfig,
  isSpecialist: boolean,
  batchId: string
): Promise<{ success: boolean; model: ModelConfig; isSpecialist: boolean; error?: string; runId?: string }> {
  const agent = getAgentFromProvider(model.provider);
  const modelLabel = isSpecialist && model.specialist
    ? `${model.specialist}/${model.model}`
    : model.model;

  const startTime = Date.now();
  const s = spinner();
  s.start(chalk.blue(`Running ${modelLabel}`));

  return new Promise((promiseResolve) => {
    try {
      // Build the command
      const cliPath = resolve(__dirname, '../packages/harness/src/cli.ts');
      const tsxPath = resolve(__dirname, '../../node_modules/.bin/tsx');

      const args = [
        cliPath,
        suite,
        scenario,
        '--tier', tier,
        '--agent', agent,
        '--model', model.model,
        '--batch-id', batchId,
        '--skip-warmup', // Skip warmup in child processes (already done once in parent)
        '--quiet' // Quiet mode for cleaner parallel output
      ];

      // Add specialist flag when provided
      if (isSpecialist && model.specialist) {
        args.push('--specialist');
        args.push(model.specialist);
      }

      // Execute the benchmark with streaming output (use absolute path to tsx)
      const child = spawn(tsxPath, args, {
        cwd: resolve(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe'] as const
      });

      let lastOutput = '';
      let errorOutput = '';

      // Stream stdout with real-time updates
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          const output = data.toString();
          lastOutput = output.trim().split('\n').pop() || lastOutput;

          // Update spinner with last meaningful line
          if (lastOutput && !lastOutput.startsWith(' ') && lastOutput.length < 100) {
            s.message(chalk.blue(`${modelLabel}: ${chalk.dim(lastOutput)}`));
          }
        });
      }

      // Capture stderr
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      }

      // Handle completion
      child.on('close', (code) => {
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

        if (code === 0) {
          s.stop(chalk.green(`✓ ${modelLabel} completed (${duration}m)`));
          promiseResolve({ success: true, model, isSpecialist });
        } else {
          const errorMsg = errorOutput || `Process exited with code ${code}`;
          s.stop(chalk.red(`✗ ${modelLabel} failed (${duration}m)`));
          if (errorOutput) {
            console.error(chalk.red(errorOutput));
          }
          promiseResolve({ success: false, model, isSpecialist, error: errorMsg });
        }
      });

      // Handle errors
      child.on('error', (error) => {
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        s.stop(chalk.red(`✗ ${modelLabel} failed (${duration}m)`));
        console.error(chalk.red(error.message));
        promiseResolve({ success: false, model, isSpecialist, error: error.message });
      });
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const errorMsg = error instanceof Error ? error.message : String(error);
      s.stop(chalk.red(`✗ ${modelLabel} failed (${duration}m)`));
      console.error(chalk.red(errorMsg));
      promiseResolve({ success: false, model, isSpecialist, error: errorMsg });
    }
  });
}

/**
 * Run tasks with limited concurrency to avoid resource exhaustion
 * @param items Array of items to process
 * @param concurrency Maximum number of concurrent executions
 * @param executor Function to execute for each item
 * @returns Array of settled results
 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  executor: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  const totalBatches = Math.ceil(items.length / concurrency);
  let batchNumber = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    batchNumber++;
    const batch = items.slice(i, i + concurrency);
    const batchSize = batch.length;

    console.log(chalk.cyan(`\n📦 Batch ${batchNumber}/${totalBatches}: Running ${batchSize} benchmark${batchSize > 1 ? 's' : ''} concurrently\n`));

    const batchResults = await Promise.allSettled(batch.map(executor));
    results.push(...batchResults);

    const completed = results.length;
    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success)).length;

    console.log(chalk.gray(`\n   Progress: ${completed}/${items.length} completed (${successful} ✓, ${failed} ✗)`));
  }

  return results;
}

async function main() {
  console.log(chalk.cyan.bold('\n🚀 Running benchmarks for all models\n'));

  try {
    // Parse arguments
    const options = parseArgs();

    // Load models configuration
    console.log(chalk.blue('📋 Loading models configuration...'));
    const config = loadModelsConfig(options.modelsConfigPath);

    console.log(chalk.green(`✓ Found ${config.vanilla_models.length} vanilla models`));
    console.log(chalk.green(`✓ Found ${config.specialist_models.length} specialist models`));

    // Generate a single batch ID for all benchmarks in this run
    const batchId = uuidv4();
    console.log(chalk.cyan(`\n📦 Batch ID: ${chalk.bold(batchId)}`));
    console.log(chalk.gray(`   Use this ID with: pnpm mint:snapshot <template> ${batchId}\n`));

    // Create batch record in database (uses config or env var BENCHMARK_DB_PATH)
    const logger = BenchmarkLogger.getInstance();
    logger.createBatch(batchId);
    logger.close();

    // Execute warmup once before all benchmarks
    console.log(chalk.blue('\n🔥 Running warmup phase...'));
    try {
      const scenarioCfg = loadScenario(options.suite, options.scenario);
      const warmupResult = await executeWarmup(
        options.suite,
        options.scenario,
        scenarioCfg,
        createAgentAdapter,
        false // quiet = false for warmup to show output
      );

      if (!warmupResult.success) {
        console.error(chalk.red(`✗ Warmup failed: ${warmupResult.error}`));
        console.log(chalk.yellow('⚠️  Continuing with benchmarks anyway (warmup is optional)'));
      } else {
        console.log(chalk.green('✓ Warmup completed successfully\n'));
      }
    } catch (error) {
      console.error(chalk.red(`✗ Warmup error: ${error instanceof Error ? error.message : String(error)}`));
      console.log(chalk.yellow('⚠️  Continuing with benchmarks anyway (warmup is optional)\n'));
    }

    // Combine all models into one array for parallel execution
    const allBenchmarks = [
      ...config.vanilla_models.map(m => ({ model: m, isSpecialist: false })),
      ...config.specialist_models.map(m => ({ model: m, isSpecialist: true }))
    ];

    const totalBenchmarks = allBenchmarks.length;
    const concurrency = 10;

    console.log(chalk.bold(`\n🚀 Benchmark Execution Plan`));
    console.log(chalk.gray(`   Total benchmarks: ${totalBenchmarks}`));
    console.log(chalk.gray(`   Running ${concurrency} at a time (max concurrent benchmarks)`));
    console.log(chalk.gray(`   Estimated batches: ${Math.ceil(totalBenchmarks / concurrency)}`));
    console.log();

    // Run ALL benchmarks with concurrency control
    const startTime = Date.now();
    const settledResults = await runWithConcurrency(
      allBenchmarks,
      concurrency,
      ({ model, isSpecialist }) => runBenchmark(
        options.suite,
        options.scenario,
        options.tier,
        model,
        isSpecialist,
        batchId
      )
    );

    // Process results from Promise.allSettled
    const results = settledResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Handle rejected promises
        const benchmark = allBenchmarks[index];
        return {
          success: false,
          model: benchmark.model,
          isSpecialist: benchmark.isSpecialist,
          error: result.reason?.message || String(result.reason)
        };
      }
    });

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(chalk.green(`\n✨ All benchmarks completed in ${chalk.bold(duration)} minutes\n`));

    // Print final summary
    console.log(chalk.bold.green('\n✨ All benchmarks completed!\n'));
    console.log(chalk.bold('Summary:'));
    console.log(`  Batch ID: ${chalk.cyan(batchId)}`);
    console.log(`  Duration: ${chalk.cyan(duration + 'm')}`);
    console.log(`  Total runs: ${chalk.cyan(results.length)}`);
    console.log(`  Successful: ${chalk.green(results.filter(r => r.success).length)}`);
    console.log(`  Failed: ${chalk.red(results.filter(r => !r.success).length)}`);

    console.log(chalk.bold('\n💡 Next steps:'));
    console.log(`  ${chalk.cyan('pnpm mint:snapshot')} <template-path> ${batchId}`);
    console.log(`  ${chalk.cyan('pnpm batch:details')} ${batchId}`);

    console.log(chalk.bold('\n🌐 View results:'));
    console.log(`  ${chalk.cyan('pnpm dashboard:dev')}\n`);

    // Exit with error code if any runs failed
    if (results.some(r => !r.success)) {
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
