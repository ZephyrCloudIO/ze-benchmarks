#!/usr/bin/env tsx
import { config } from 'dotenv';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Load environment variables from .env file in project root
// Find workspace root by looking for pnpm-workspace.yaml
// In case of nested workspaces, find the topmost one
function findWorkspaceRoot(startDir: string): string {
  let currentDir = startDir;
  let lastWorkspaceRoot = startDir;

  while (currentDir !== resolve(currentDir, '..')) {
    if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      lastWorkspaceRoot = currentDir;
    }
    currentDir = resolve(currentDir, '..');
  }

  return lastWorkspaceRoot;
}

const workspaceRoot = findWorkspaceRoot(process.cwd());
const envPath = resolve(workspaceRoot, '.env');
config({ path: envPath });

// External package imports
import { BenchmarkLogger } from '@ze/worker-client';
import { intro, outro } from '@clack/prompts';
import chalk from 'chalk';

// Runtime imports
import { startDevServer, stopDevServer } from './dev-server.ts';

// CLI module imports
import { parseArgs, showHelp } from './cli/args.ts';
import { validateEnvironment } from './cli/environment.ts';

// Interactive module imports
import { showInteractiveMenu } from './interactive/menu.ts';
import { runInteractiveBenchmark } from './interactive/benchmark.ts';
import { runInteractiveSuiteStats, runInteractiveScenarioStats, runInteractiveRunStats, runInteractiveEvaluators } from './interactive/statistics.ts';
import { runInteractiveClear } from './interactive/clear.ts';
import { createNewSuite, createNewScenario } from './interactive/suite-management.ts';

// Execution module imports
import { executeBenchmark } from './execution/benchmark.ts';

// Lib module imports
import { formatStats, displayRunInfo } from './lib/display.ts';
import { logger } from '@ze/logger';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function findRepoRoot(): string {
  let currentDir = process.cwd();
  while (currentDir !== resolve(currentDir, '..')) {
    if (existsSync(join(currentDir, 'suites'))) {
      return currentDir;
    }
    currentDir = resolve(currentDir, '..');
  }
  throw new Error('Could not find repo root (no suites directory found)');
}

function validateName(name: string, type: 'suite' | 'scenario'): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: `${type} name cannot be empty` };
  }
  if (!/^[a-z0-9-]+$/.test(name)) {
    return { valid: false, error: `${type} name must be kebab-case (lowercase letters, numbers, and hyphens only)` };
  }
  if (name.startsWith('-') || name.endsWith('-')) {
    return { valid: false, error: `${type} name cannot start or end with a hyphen` };
  }
  return { valid: true };
}

function checkSuiteExists(suiteName: string): boolean {
  const root = findRepoRoot();
  return existsSync(join(root, 'suites', suiteName));
}

function checkScenarioExists(suiteName: string, scenarioName: string): boolean {
  const root = findRepoRoot();
  return existsSync(join(root, 'suites', suiteName, 'scenarios', scenarioName));
}

// Export for use by other modules
export { findRepoRoot, validateName, checkSuiteExists, checkScenarioExists };

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function run() {
	// Log entry point immediately (FIRST THING)
	logger.cli.debug('[DEBUG] Benchmark CLI started');
	logger.cli.debug(`  Args: ${JSON.stringify(process.argv)}`);
	logger.cli.debug(`  CWD: ${process.cwd()}`);

	const parsedArgs = parseArgs(process.argv);
	logger.cli.debug(`  Parsed args: ${JSON.stringify(parsedArgs)}`);

	// Skip environment validation for creation commands (they don't need API keys)
	const skipValidation = parsedArgs.cmd === 'new-suite' || parsedArgs.cmd === 'new-scenario';

	// Check for required environment variables first (unless skipping for creation commands)
	if (!skipValidation) {
		await validateEnvironment();
	}

	// Dev server will be started only when viewing statistics

	// If no arguments provided, show interactive menu
	if (process.argv.length <= 2) {
		await showInteractiveMenu();
		return;
	}

	// Handle stats command
	if (parsedArgs.cmd === 'stats') {
		const benchmarkLogger = BenchmarkLogger.getInstance();
		const { level, identifier } = parsedArgs;

		try {
			if (level === 'suite') {
					if (!identifier[0]) {
					logger.cli.warn('Usage: pnpm bench --stats suite <suite-name>');
					return;
				}
					await runInteractiveSuiteStats();

			} else if (level === 'scenario') {
					if (!identifier[0] || !identifier[1]) {
					logger.cli.warn('Usage: pnpm bench --stats scenario <suite> <scenario>');
					return;
				}
					await runInteractiveScenarioStats();

			} else if (level === 'run') {
					if (!identifier[0]) {
					logger.cli.warn('Usage: pnpm bench --stats run <run-id>');
					return;
				}
					await runInteractiveRunStats();

			} else {
				logger.cli.warn('Usage: pnpm bench --stats <level> <identifier>');
				logger.cli.raw('  pnpm bench --stats suite <suite-name>');
				logger.cli.raw('  pnpm bench --stats scenario <suite> <scenario>');
				logger.cli.raw('  pnpm bench --stats run <run-id>');
			}
		} catch (error) {
			logger.cli.error(chalk.red('Failed to fetch statistics:'));
			logger.cli.debug(error instanceof Error ? error.message : String(error));
			process.exit(1);
		} finally {
			benchmarkLogger.close();
		}
		return;
	}

	// Handle clear-db command
	if (parsedArgs.cmd === 'clear-db') {
		await runInteractiveClear();
		return;
	}

	// Handle evaluators command
	if (parsedArgs.cmd === 'evaluators') {
		await runInteractiveEvaluators();
		return;
	}

	// Handle history command
	if (parsedArgs.cmd === 'history') {
		const benchmarkLogger = BenchmarkLogger.getInstance();
		const limit = parsedArgs.limit;

		intro(chalk.bgCyan(' Benchmark History '));

		try {
			const runHistory = await benchmarkLogger.getRunHistory({ limit });

			if (runHistory.length === 0) {
				logger.cli.warn('No benchmark runs found');
				outro(chalk.yellow('Run a benchmark first: pnpm bench <suite> <scenario>'));
				return;
			}

			// Use common display function
			runHistory.forEach((run, index) => displayRunInfo(run, index));

			// Show overall stats
			const stats = await benchmarkLogger.getStats();
			logger.cli.raw('\n' + chalk.underline('Overall Statistics'));
			logger.cli.raw(formatStats('Total Runs', stats.totalRuns || 0));
			logger.cli.raw(formatStats('Success Rate', `${((stats.successRate || 0) * 100).toFixed(1)}%`, 'green'));
			logger.cli.raw(formatStats('Avg Score', (stats.averageScore || 0).toFixed(4), 'yellow'));
			logger.cli.raw(formatStats('Avg Weighted', (stats.averageWeightedScore || 0).toFixed(4), 'yellow'));
			logger.cli.raw(formatStats('Avg Duration', `${((stats.averageDuration || 0) / 1000).toFixed(2)}s`, 'blue'));

			outro(chalk.green(`Showing ${runHistory.length} recent runs`));

		} catch (error) {
			logger.cli.error(chalk.red('Failed to fetch history:'));
			logger.cli.debug(error instanceof Error ? error.message : String(error));
			process.exit(1);
		} finally {
			benchmarkLogger.close();
		}
		return;
	}

	// Handle batches command
	if (parsedArgs.cmd === 'batches') {
		const benchmarkLogger = BenchmarkLogger.getInstance();
		const limit = parsedArgs.limit;

		try {
			const batches = await benchmarkLogger.getAllBatches(limit);

			if (batches.length === 0) {
				logger.cli.warn('No batches found');
				outro(chalk.yellow('Run some benchmarks first'));
				return;
			}

			intro(chalk.bgCyan(' Batch History '));

			batches.forEach((batch, index) => {
				const status = batch.completedAt
					? chalk.green('✓')
					: chalk.yellow('○');
				const duration = batch.completedAt && batch.createdAt
					? `${((batch.completedAt - batch.createdAt) / 1000).toFixed(2)}s`
					: 'Running...';
				const totalRuns = batch.totalRuns || 0;
				const successfulRuns = batch.successfulRuns || 0;
				const successRate = totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(0) : 0;

				logger.cli.raw(`\n${chalk.bold(`${index + 1}.`)} ${status} ${chalk.cyan('Batch')} ${chalk.dim(batch.batchId.substring(0, 8))}...`);
				logger.cli.raw(`   ${formatStats('Runs', `${successfulRuns}/${totalRuns} (${successRate}%)`, 'green')}`);
				logger.cli.raw(`   ${formatStats('Avg Score', batch.avgWeightedScore?.toFixed(4) || 'N/A', 'yellow')}`);
				logger.cli.raw(`   ${formatStats('Duration', duration, 'blue')}`);
				logger.cli.raw(`   ${chalk.gray(new Date(batch.createdAt).toLocaleString())}`);
			});

			outro(chalk.green(`Showing ${batches.length} batches`));

		} catch (error) {
			logger.cli.error(chalk.red('Failed to fetch batches:'));
			logger.cli.debug(error instanceof Error ? error.message : String(error));
			process.exit(1);
		} finally {
			benchmarkLogger.close();
		}
		return;
	}

	// Handle batch-details command
	if (parsedArgs.cmd === 'batch-details') {
		const benchmarkLogger = BenchmarkLogger.getInstance();
		const { batchId } = parsedArgs;

		if (!batchId) {
			logger.cli.warn('Usage: pnpm bench --batch-details <batch-id>');
			return;
		}

		try {
			const analytics = await benchmarkLogger.getBatchAnalytics(batchId);

			if (!analytics) {
				logger.cli.error(chalk.red(`Batch ${batchId} not found`));
				return;
			}

			intro(chalk.bgCyan(' Batch Details '));

			// Get batch details separately since analytics doesn't include batch info
			const batchDetails = await benchmarkLogger.getBatchDetails(batchId);
			if (!batchDetails) {
				logger.cli.error(chalk.red(`Batch ${batchId} not found`));
				return;
			}

			const totalRuns = batchDetails.totalRuns || 0;
			const successfulRuns = batchDetails.successfulRuns || 0;
			const successRate = totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(1) : 0;
			const duration = batchDetails.completedAt && batchDetails.createdAt
				? ((batchDetails.completedAt - batchDetails.createdAt) / 1000).toFixed(2)
				: 'Running...';

			logger.cli.raw(`\n${chalk.bold('Batch ID:')} ${chalk.dim(batchId.substring(0, 16))}...`);
			logger.cli.raw(formatStats('Status', batchDetails.completedAt ? 'Completed' : 'Running', batchDetails.completedAt ? 'green' : 'yellow'));
			logger.cli.raw(formatStats('Total Runs', `${totalRuns}`, 'blue'));
			logger.cli.raw(formatStats('Successful', `${successfulRuns}/${totalRuns} (${successRate}%)`, 'green'));
			logger.cli.raw(formatStats('Avg Score', (batchDetails.avgWeightedScore || 0).toFixed(4), 'yellow'));
			logger.cli.raw(formatStats('Duration', `${duration}s`, 'blue'));
			logger.cli.raw(formatStats('Started', new Date(batchDetails.createdAt).toLocaleString()));

			// Suite breakdown
			if (analytics.suiteBreakdown && analytics.suiteBreakdown.length > 0) {
				logger.cli.raw(`\n${chalk.bold.underline('Suite Breakdown')}`);
				analytics.suiteBreakdown.forEach((suite: any) => {
					const rate = suite.runs > 0 ? ((suite.successfulRuns / suite.runs) * 100).toFixed(0) : 0;
					logger.cli.raw(`  ${chalk.cyan(suite.suite)}/${suite.scenario}: ${(suite.avgWeightedScore || 0).toFixed(2)}/10 ${chalk.gray(`(${rate}% success, ${suite.runs} runs)`)}`);
				});
			}

			// Agent performance
			if (analytics.agentBreakdown && analytics.agentBreakdown.length > 0) {
				logger.cli.raw(`\n${chalk.bold.underline('Agent Performance')}`);
				analytics.agentBreakdown.forEach((agent: any, i: number) => {
					const rankDisplay = i < 3 ? `#${i + 1}` : `${i + 1}.`;
					const modelStr = agent.model && agent.model !== 'default' ? ` [${agent.model}]` : '';
					const scoreColor = (agent.avgWeightedScore || 0) >= 9 ? 'green' : (agent.avgWeightedScore || 0) >= 7 ? 'yellow' : 'red';
					logger.cli.raw(`  ${rankDisplay} ${chalk.cyan(agent.agent)}${modelStr}: ${chalk[scoreColor]((agent.avgWeightedScore || 0).toFixed(2))}/10 ${chalk.gray(`(${agent.successfulRuns || 0}/${agent.runs || 0})`)}`);
				});
			}

			// Tier distribution
			if (analytics.tierBreakdown && analytics.tierBreakdown.length > 0) {
				logger.cli.raw(`\n${chalk.bold.underline('Tier Distribution')}`);
				analytics.tierBreakdown.forEach((tier: any) => {
					logger.cli.raw(`  ${chalk.cyan(tier.tier)}: ${(tier.avgWeightedScore || 0).toFixed(2)}/10 ${chalk.gray(`(${tier.successfulRuns || 0}/${tier.runs || 0} runs)`)}`);
				});
			}

			// Failed runs (from runs array)
			const failedRuns = analytics.runs?.filter((run: any) => run.status === 'failed') || [];
			if (failedRuns.length > 0) {
				logger.cli.raw(`\n${chalk.bold.underline(chalk.red('Failed Runs'))}`);
				failedRuns.forEach((run: any) => {
					logger.cli.raw(`  ${chalk.red('✗')} ${run.suite}/${run.scenario} (${run.tier}) ${run.agent}`);
				});
			}

			outro(chalk.green('Batch analytics complete'));

		} catch (error) {
			logger.cli.error(chalk.red('Failed to fetch batch details:'));
			logger.cli.debug(error instanceof Error ? error.message : String(error));
			process.exit(1);
		} finally {
			benchmarkLogger.close();
		}
		return;
	}

	// Handle compare-batches command
	if (parsedArgs.cmd === 'compare-batches') {
		const benchmarkLogger = BenchmarkLogger.getInstance();
		const { batchIds } = parsedArgs;

		if (!batchIds || batchIds.length < 2) {
			logger.cli.warn('Usage: pnpm bench --compare-batches <batch-id1> <batch-id2> [batch-id3...]');
			return;
		}

		try {
			// getBatchComparison doesn't take parameters yet - fetch batches individually
			const batches = await Promise.all(
				batchIds.map(id => benchmarkLogger.getBatchDetails(id))
			).then(results => results.filter((b): b is NonNullable<typeof b> => b !== null));

			if (batches.length === 0) {
				logger.cli.error(chalk.red('No batches found with the provided IDs'));
				return;
			}

			intro(chalk.bgMagenta(' Batch Comparison '));

			logger.cli.raw(`\n${chalk.bold('Comparing')} ${batches.length} batches:\n`);

			// Create comparison table
			logger.cli.raw(chalk.bold('Batch'.padEnd(12)) + ' | ' +
			           chalk.bold('Runs'.padEnd(8)) + ' | ' +
			           chalk.bold('Success'.padEnd(10)) + ' | ' +
			           chalk.bold('Avg Score'.padEnd(10)) + ' | ' +
			           chalk.bold('Duration'));
			logger.cli.raw('─'.repeat(70));

			batches.forEach(batch => {
				const batchIdShort = batch.batchId.substring(0, 8) + '...';
				const totalRuns = batch.totalRuns || 0;
				const successfulRuns = batch.successfulRuns || 0;
				const successRate = totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(0) + '%' : 'N/A';
				const duration = batch.completedAt && batch.createdAt
					? `${((batch.completedAt - batch.createdAt) / 1000).toFixed(0)}s`
					: 'N/A';
				const score = batch.avgWeightedScore?.toFixed(2) || 'N/A';

				logger.cli.raw(
					chalk.dim(batchIdShort.padEnd(12)) + ' | ' +
					`${totalRuns}`.padEnd(8) + ' | ' +
					successRate.padEnd(10) + ' | ' +
					chalk.yellow(score.padEnd(10)) + ' | ' +
					duration
				);
			});

			// Show best performer
			const bestBatch = batches.reduce((best, current) =>
				(current.avgWeightedScore || 0) > (best.avgWeightedScore || 0) ? current : best
			);

			logger.cli.raw(`\n${chalk.green('Best performing batch:')} ${chalk.dim(bestBatch.batchId.substring(0, 8))}... with score ${chalk.bold(bestBatch.avgWeightedScore?.toFixed(4) || 'N/A')}`);

			outro(chalk.green('Comparison complete'));

		} catch (error) {
			logger.cli.error(chalk.red('Failed to compare batches:'));
			logger.cli.debug(error instanceof Error ? error.message : String(error));
			process.exit(1);
		} finally {
			benchmarkLogger.close();
		}
		return;
	}

	// Handle new-suite command
	if (parsedArgs.cmd === 'new-suite') {
		await createNewSuite(parsedArgs.name);
		return;
	}

	// Handle new-scenario command
	if (parsedArgs.cmd === 'new-scenario') {
		const { suite, name } = parsedArgs;
		if (!suite || !name) {
			logger.cli.warn('Usage: pnpm bench --new-scenario <suite> <name>');
			logger.cli.raw('  Or run without arguments for interactive mode');
			return;
		}
		await createNewScenario(suite, name);
		return;
	}

	const { cmd, suite, scenario, tier, agent, model, specialist, skipWarmup, warmupOnly, quiet, llmJudgeOnly, enrichTemplate, iterations } = parsedArgs;
	if (cmd !== 'bench' || !suite || !scenario) {
		showHelp();
		process.exit(1);
	}

	// Log resolved paths BEFORE any benchmark operations
	try {
		logger.cli.debug('[DEBUG] Path resolution:');
		const repoRoot = findRepoRoot();
		logger.cli.debug(`  Repo root: ${repoRoot}`);

		// Try to resolve scenario paths
		try {
			const { getScenarioDir } = await import('./domain/scenario.ts');
			const scenarioDir = getScenarioDir(suite, scenario);
			logger.cli.debug(`  Scenario dir: ${scenarioDir}`);
			logger.cli.debug(`  Scenario dir exists: ${existsSync(scenarioDir)}`);

			const scenarioYaml = join(scenarioDir, 'scenario.yaml');
			logger.cli.debug(`  Scenario yaml: ${scenarioYaml}`);
			logger.cli.debug(`  Scenario yaml exists: ${existsSync(scenarioYaml)}`);
		} catch (pathErr) {
			logger.cli.error(`[DEBUG] Failed to resolve scenario paths: ${pathErr instanceof Error ? pathErr.message : String(pathErr)}`);
		}
	} catch (rootErr) {
		logger.cli.error(`[DEBUG] Failed to resolve repo root: ${rootErr instanceof Error ? rootErr.message : String(rootErr)}`);
	}

	// Handle warmup-only mode
	if (warmupOnly) {
		logger.cli.info('Running warmup only...');
		logger.cli.info(`Suite: ${suite}, Scenario: ${scenario}`);

		// Import necessary modules
		const { loadScenario } = await import('./domain/scenario.ts');
		const { executeWarmup } = await import('./domain/warmup.ts');
		const { createAgentAdapter } = await import('./domain/agent.ts');

		try {
			const scenarioCfg = loadScenario(suite, scenario);
			const warmupResult = await executeWarmup(suite, scenario, scenarioCfg, createAgentAdapter, false);

			if (!warmupResult.success) {
				logger.cli.error(`\n❌ Warmup failed: ${warmupResult.error}`);
				if (warmupResult.agentError) {
					logger.cli.error(`Agent error: ${warmupResult.agentError}`);
				}
				process.exit(1);
			}

			logger.cli.success('\n✓ Warmup completed successfully');
			logger.cli.info(`Control folder: ${warmupResult.controlPath}`);
			if (warmupResult.controlContents && warmupResult.controlContents.length > 0) {
				logger.cli.info(`Contents (${warmupResult.controlContents.length} items):`);
				warmupResult.controlContents.forEach(item => {
					logger.cli.debug(`  - ${item}`);
				});
			}
			process.exit(0);
		} catch (error) {
			logger.cli.error(`\n❌ Warmup exception: ${error instanceof Error ? error.message : String(error)}`);
			if (error instanceof Error && error.stack) {
				logger.cli.debug(error.stack);
			}
			process.exit(1);
		}
	}

	// Show modern CLI intro with hyperfine-style header (skip if quiet mode)
	if (!quiet) {
		logger.cli.raw(chalk.bold.underline('Demo: Benchmarking AI Agents:'));
		const agentDisplay = agent || (specialist ? 'auto-detect' : 'echo');
		logger.cli.raw(`\n${chalk.green('►')} ${chalk.green('pnpm bench')} ${chalk.yellow(`'${suite}/${scenario}'`)} ${chalk.yellow(`'${tier}'`)} ${chalk.yellow(`'${agentDisplay}'`)}`);

		logger.cli.info(chalk.bold(`Running: ${suite}/${scenario}`));
		logger.cli.info(`${chalk.gray('Tier:')} ${chalk.cyan(tier)} ${chalk.gray('Agent:')} ${chalk.cyan(agentDisplay)}`);
		if (specialist && !agent) {
			logger.cli.info(chalk.blue(`  ℹ️  Agent will be auto-detected from specialist preferred model`));
		}

		// Warn if OpenRouter agent but no model specified (and no specialist to auto-detect)
		if (agent === 'openrouter' && !model && !specialist && !process.env.OPENROUTER_MODEL) {
			logger.cli.warn(`\n⚠️  Warning: No model specified for OpenRouter agent. Using default model.`);
			logger.cli.debug(`   Tip: Use --model flag or set OPENROUTER_MODEL environment variable`);
			logger.cli.debug(`   Example: pnpm bench ${suite}/${scenario} ${tier} ${agent} --model openai/gpt-4o-mini\n`);
		}
	}

	// Initialize batch tracking (same as interactive mode)
	const benchmarkLogger = BenchmarkLogger.getInstance();
	
	// Always create new batch using proper format (batch-{timestamp}-{random})
	const actualBatchId = await benchmarkLogger.startBatch();

	if (iterations > 1 && !quiet) {
		logger.cli.info(chalk.blue(`Running ${iterations} iterations with batch ID: ${actualBatchId}`));
	} else if (!quiet) {
		logger.cli.info(chalk.gray(`Batch ID: ${actualBatchId}`));
	}

	// Track results for batch completion
	const startTime = Date.now();

	// Run benchmark iterations
	for (let i = 0; i < iterations; i++) {
		if (iterations > 1 && !quiet) {
			logger.cli.info(chalk.cyan(`\n--- Iteration ${i + 1}/${iterations} ---`));
		}

		await executeBenchmark(suite, scenario, tier, agent, model, actualBatchId, quiet, specialist, skipWarmup, llmJudgeOnly);
	}

	// Complete batch with statistics
	try {
		// Get batch statistics from the database
		const batchStats = await benchmarkLogger.getBatchDetails(actualBatchId);
		if (batchStats) {
			const successfulRuns = await benchmarkLogger.getBatchSuccessfulRunsCount(actualBatchId);
			const scoreStats = await benchmarkLogger.getBatchScoreStats(actualBatchId);
			
			await benchmarkLogger.completeBatch(actualBatchId, {
				totalRuns: iterations,
				successfulRuns: successfulRuns,
				avgScore: scoreStats.avgScore || 0,
				avgWeightedScore: scoreStats.avgWeightedScore || 0,
				metadata: {
					suite,
					scenario,
					tier,
					agent: agent || (specialist ? 'auto-detect' : 'echo'),
					model,
					specialist,
					iterations,
					duration: Date.now() - startTime
				}
			});
		}
	} catch (error) {
		// Log but don't fail - batch completion is best effort
		if (!quiet) {
			logger.cli.warn(chalk.yellow(`Failed to complete batch: ${error instanceof Error ? error.message : String(error)}`));
		}
	}

	// After all iterations complete, enrich template if requested
	if (enrichTemplate) {
		if (!quiet) {
			logger.cli.info(chalk.blue(`\n🔍 Enriching template: ${enrichTemplate}`));
		}

		try {
			// Import enrichment function
			const { enrichTemplate: enrichTemplateFunc } = await import('../../specialist-mint/src/enrich-template.js');

			const result = await enrichTemplateFunc(enrichTemplate, {
				provider: (process.env.ENRICHMENT_PROVIDER as 'openrouter' | 'anthropic') || 'openrouter',
				model: process.env.ENRICHMENT_MODEL || 'anthropic/claude-3.5-haiku',
				force: false,
				timeoutMs: 30000,
				concurrency: 3
			});

			if (!quiet) {
				logger.cli.success('\n✅ Template enrichment completed!');
				logger.cli.debug(`   Enriched template: ${result.enrichedTemplatePath}`);
				logger.cli.debug(`   Documents enriched: ${result.documentsEnriched}`);
				logger.cli.debug(`   Documents skipped: ${result.documentsSkipped}`);

				if (result.errors.length > 0) {
					logger.cli.warn(`   Errors: ${result.errors.length}`);
					result.errors.forEach(err => {
						logger.cli.warn(`     - ${err}`);
					});
				}
				logger.cli.raw();
			}
		} catch (error) {
			logger.cli.error(chalk.red('\n❌ Error enriching template:'));
			logger.cli.error(`   ${error instanceof Error ? error.message : String(error)}`);
			if (!quiet) {
				logger.cli.warn('\n💡 Tip: Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY in .env');
			}
			process.exit(1);
		}
	}
}

// Cleanup handlers
process.on('exit', () => {
	stopDevServer();
});

process.on('SIGINT', () => {
    logger.cli.raw('\nShutting down...');
    try {
        const benchmarkLogger = BenchmarkLogger.getInstance();
        // Mark current run incomplete if any
        (logger as any).markRunIncomplete?.('Interrupted by user (SIGINT)', 'signal');
        logger.cli.warn('⚠ Current run marked as incomplete');
    } catch {}
    stopDevServer();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.cli.raw('\nShutting down...');
    try {
        const benchmarkLogger = BenchmarkLogger.getInstance();
        (logger as any).markRunIncomplete?.('Interrupted by system (SIGTERM)', 'signal');
        logger.cli.warn('⚠ Current run marked as incomplete');
    } catch {}
    stopDevServer();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
	logger.cli.error('\nUncaught Exception:', err);
	stopDevServer();
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.cli.error('\nUnhandled Rejection at:', promise, 'reason:', reason);
	stopDevServer();
	process.exit(1);
});

run().catch(async (err) => {
	logger.cli.error('\n[DEBUG] CLI run() caught exception');
	logger.cli.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
	if (err instanceof Error && err.stack) {
		logger.cli.debug(`  Stack trace:\n${err.stack}`);
	}

	logger.cli.raw(`\n${chalk.red('✗')} Benchmark failed: ${err instanceof Error ? err.message : String(err)}`);

	// Try to log the error to database if logger is available
	try {
		const benchmarkLogger = BenchmarkLogger.getInstance();
		await benchmarkLogger.failRun(String(err));
	} catch (logErr) {
		logger.cli.raw(`${chalk.yellow('⚠')} Failed to log error to database: ${logErr instanceof Error ? logErr.message : String(logErr)}`);
	}

	stopDevServer();
	process.exit(1);
});
