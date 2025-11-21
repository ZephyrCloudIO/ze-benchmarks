import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { select, intro, outro, log } from '@clack/prompts';
import chalk from 'chalk';
import { BenchmarkLogger } from '@ze/worker-client';
import { startDevServer } from '../dev-server.ts';
import { findRepoRoot } from '../lib/workspace-utils.ts';
import { formatStats, displayModelPerformance } from '../lib/display.ts';
import { logger } from '@ze/logger';

// ============================================================================
// INTERACTIVE SUITE STATISTICS
// ============================================================================

export async function runInteractiveSuiteStats() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		logger.stats.raw(`\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')}`);
		logger.stats.raw(`   ${chalk.blue.underline(serverUrl)} ${chalk.gray('- Click to open interactive dashboard')}`);
		logger.stats.raw(`   ${chalk.gray('Features: Charts, analytics, batch comparison, and detailed run analysis')}`);
	} catch (err) {
		// Continue without web server
		logger.stats.warn('⚠ Web server not available, showing CLI statistics only');
	}

	const benchmarkLogger = BenchmarkLogger.getInstance();

	try {
			// Get available suites
			const root = findRepoRoot();
			const suitesDir = join(root, 'suites');
			const suites = readdirSync(suitesDir).filter(dir =>
				existsSync(join(suitesDir, dir, 'scenarios'))
			);

		if (suites.length === 0) {
			log.error(chalk.red('No suites found'));
			return;
		}

			const selectedSuite = await select({
				message: 'Choose a suite:',
				options: suites.map(suite => ({ value: suite, label: suite }))
			}) as string;

			// Execute suite stats
			const stats = await benchmarkLogger.getSuiteStats(selectedSuite);
			logger.stats.raw(chalk.bold.bgBlue(` Suite: ${selectedSuite} `));
			logger.stats.raw('\n' + chalk.underline('Overview'));
			if (Array.isArray(stats)) {
				log.warning('No suite statistics available');
				return;
			}
			logger.stats.raw(formatStats('Total Runs', stats.totalRuns ?? 0));
			logger.stats.raw(formatStats('Success Rate', `${(stats.totalRuns ?? 0) > 0 ? (((stats.successfulRuns ?? 0) / (stats.totalRuns ?? 1)) * 100).toFixed(1) : 0}%`, 'green'));
			logger.stats.raw(formatStats('Avg Score', (stats.avgScore ?? 0).toFixed(4), 'yellow'));
			logger.stats.raw(formatStats('Avg Weighted', (stats.avgWeightedScore ?? 0).toFixed(4), 'yellow'));
			logger.stats.raw(formatStats('Avg Duration', `${((stats.avgDuration ?? 0) / 1000).toFixed(2)}s`, 'blue'));

			if (stats.scenarioBreakdown && stats.scenarioBreakdown.length > 0) {
				logger.stats.raw('\n' + chalk.underline('Scenario Breakdown'));
				stats.scenarioBreakdown.forEach(scenario => {
					logger.stats.raw(`  ${chalk.cyan('•')} ${chalk.bold(scenario.scenario)}: ${chalk.yellow((scenario.avgScore ?? 0).toFixed(4))} ${chalk.gray(`(${scenario.totalRuns} runs)`)}`);
				});
			}

	} catch (error) {
		log.error(chalk.red('Failed to fetch suite statistics:'));
		logger.stats.debug(error instanceof Error ? error.message : String(error));
	} finally {
		benchmarkLogger.close();
	}
}

// ============================================================================
// INTERACTIVE SCENARIO STATISTICS
// ============================================================================

export async function runInteractiveScenarioStats() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		logger.stats.raw(`\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')}`);
		logger.stats.raw(`   ${chalk.blue.underline(serverUrl)} ${chalk.gray('- Click to open interactive dashboard')}`);
		logger.stats.raw(`   ${chalk.gray('Features: Charts, analytics, batch comparison, and detailed run analysis')}`);
	} catch (err) {
		// Continue without web server
		logger.stats.warn('⚠ Web server not available, showing CLI statistics only');
	}

	const benchmarkLogger = BenchmarkLogger.getInstance();

	try {
			// Get available suites and scenarios
			const root = findRepoRoot();
			const suitesDir = join(root, 'suites');
			const suites = readdirSync(suitesDir).filter(dir =>
				existsSync(join(suitesDir, dir, 'scenarios'))
			);

			const selectedSuite = await select({
				message: 'Choose a suite:',
				options: suites.map(suite => ({ value: suite, label: suite }))
			}) as string;

			const scenariosDir = join(suitesDir, selectedSuite, 'scenarios');
			const scenarios = readdirSync(scenariosDir).filter(dir =>
				existsSync(join(scenariosDir, dir, 'scenario.yaml'))
			);

			const selectedScenario = await select({
				message: 'Choose a scenario:',
				options: scenarios.map(scenario => ({ value: scenario, label: scenario }))
			}) as string;

			// Execute scenario stats
			const stats = await benchmarkLogger.getScenarioStats(selectedSuite, selectedScenario);
			logger.stats.raw(chalk.bold.bgMagenta(` ${selectedSuite}/${selectedScenario} `));

			if (Array.isArray(stats)) {
				log.warning('No scenario statistics available');
				return;
			}

			// Score range with visual bar
			const avgWeighted = stats.avgWeightedScore ?? 0;
			const scorePercent = (avgWeighted / 10) * 100;
			const barLength = 20;
			const filled = Math.round((scorePercent / 100) * barLength);
			const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(barLength - filled));
			logger.stats.raw(`\n${bar} ${chalk.bold(avgWeighted.toFixed(2))}/10`);

			logger.stats.raw('\n' + chalk.underline('Overview'));
			logger.stats.raw(formatStats('Total Runs', stats.totalRuns ?? 0));
			logger.stats.raw(formatStats('Success Rate', `${(stats.totalRuns ?? 0) > 0 ? (((stats.successfulRuns ?? 0) / (stats.totalRuns ?? 1)) * 100).toFixed(1) : 0}%`, 'green'));
			logger.stats.raw(formatStats('Avg Score', (stats.avgScore ?? 0).toFixed(4), 'yellow'));
			logger.stats.raw(formatStats('Score Range', `${(stats.minScore ?? 0).toFixed(4)} - ${(stats.maxScore ?? 0).toFixed(4)}`, 'blue'));

			// Agent comparison table
			if (stats.agentComparison && stats.agentComparison.length > 0) {
				logger.stats.raw('\n' + chalk.underline('Agent Performance'));
				stats.agentComparison.forEach((agent, i) => {
					const rank = i + 1;
					const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
					logger.stats.raw(`  ${rankDisplay} ${chalk.cyan(agent.agent.padEnd(15))} ${chalk.yellow(agent.avgScore.toFixed(4))} ${chalk.gray(`(${agent.runs} runs)`)}`);
				});
			}

	} catch (error) {
		log.error(chalk.red('Failed to fetch scenario statistics:'));
		logger.stats.debug(error instanceof Error ? error.message : String(error));
	} finally {
		benchmarkLogger.close();
	}
}

// ============================================================================
// INTERACTIVE RUN STATISTICS
// ============================================================================

export async function runInteractiveRunStats() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		logger.stats.raw(`\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')}`);
		logger.stats.raw(`   ${chalk.blue.underline(serverUrl)} ${chalk.gray('- Click to open interactive dashboard')}`);
		logger.stats.raw(`   ${chalk.gray('Features: Charts, analytics, batch comparison, and detailed run analysis')}`);
	} catch (err) {
		// Continue without web server
		logger.stats.warn('⚠ Web server not available, showing CLI statistics only');
	}

	const benchmarkLogger = BenchmarkLogger.getInstance();

	try {
			// Get recent runs to choose from
			const runHistory = await benchmarkLogger.getRunHistory({ limit: 10 });

			if (runHistory.length === 0) {
				log.warning('No benchmark runs found');
				outro(chalk.yellow('Run a benchmark first'));
				return;
			}

			const selectedRun = await select({
				message: 'Choose a run to view details:',
				options: runHistory.map((run, index) => ({
					value: run.runId,
					label: `${index + 1}. ${run.suite}/${run.scenario} (${run.tier}) - ${run.agent} - ${run.weightedScore?.toFixed(4) || 'N/A'}`
				}))
			}) as string;

			// Execute run stats
			const stats = await benchmarkLogger.getDetailedRunStats(selectedRun);
			logger.stats.raw(chalk.bold.bgGreen(` Run Details `));
			logger.stats.raw(`\n${chalk.gray('ID:')} ${chalk.dim(selectedRun.substring(0, 8))}...`);
			logger.stats.raw(formatStats('Suite', stats.suite));
			logger.stats.raw(formatStats('Scenario', stats.scenario));
			logger.stats.raw(formatStats('Tier', stats.tier));
			logger.stats.raw(formatStats('Agent', stats.agent + (stats.model ? ` (${stats.model})` : '')));
			logger.stats.raw(formatStats('Status', stats.status, stats.status === 'completed' ? 'green' : stats.status === 'failed' ? 'red' : 'yellow'));
			logger.stats.raw(formatStats('Started', new Date(stats.startedAt).toLocaleString()));
			if (stats.completedAt) {
				logger.stats.raw(formatStats('Completed', new Date(stats.completedAt).toLocaleString()));
			}
			if (stats.totalScore !== null && stats.totalScore !== undefined) {
				logger.stats.raw(formatStats('Total Score', stats.totalScore.toFixed(4), 'green'));
			}
			if (stats.weightedScore !== null && stats.weightedScore !== undefined) {
				logger.stats.raw(formatStats('Weighted Score', stats.weightedScore.toFixed(4), 'green'));
			}

			// Evaluation breakdown with progress bars
			if (stats.evaluations && stats.evaluations.length > 0) {
				logger.stats.raw('\n' + chalk.underline('Evaluations'));
				stats.evaluations.forEach((evaluation: { evaluatorName: string; score: number; maxScore: number }) => {
					const percent = (evaluation.score / evaluation.maxScore) * 100;
					const color = percent === 100 ? 'green' : percent >= 80 ? 'yellow' : 'red';
					const barLength = 15;
					const filled = Math.round((percent / 100) * barLength);
					const bar = chalk[color]('█'.repeat(filled)) + chalk.gray('░'.repeat(barLength - filled));

					logger.stats.raw(`  ${evaluation.evaluatorName.padEnd(30)} ${bar} ${chalk[color](percent.toFixed(1) + '%')}`);
				});
			}

			if (stats.telemetry) {
				logger.stats.raw('\n' + chalk.underline('Telemetry'));
				logger.stats.raw(formatStats('Tool Calls', stats.telemetry.toolCalls ?? 0, 'blue'));
				const tokensIn = stats.telemetry.tokensIn ?? 0;
				const tokensOut = stats.telemetry.tokensOut ?? 0;
				logger.stats.raw(formatStats('Tokens', `${tokensIn} in / ${tokensOut} out`, 'blue'));
				logger.stats.raw(formatStats('Cost', `$${(stats.telemetry.costUsd ?? 0).toFixed(6)}`, 'blue'));
				logger.stats.raw(formatStats('Duration', `${((stats.telemetry.durationMs ?? 0) / 1000).toFixed(2)}s`, 'blue'));
			}

	} catch (error) {
		log.error(chalk.red('Failed to fetch run statistics:'));
		logger.stats.debug(error instanceof Error ? error.message : String(error));
	} finally {
		benchmarkLogger.close();
	}
}

// ============================================================================
// INTERACTIVE BATCH STATISTICS
// ============================================================================

export async function runInteractiveBatchStats() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		logger.stats.debug(`\nView in browser: ${serverUrl}`);
	} catch (err) {
		// Continue without web server
	}

	const benchmarkLogger = BenchmarkLogger.getInstance();

	try {
			// Get recent batches to choose from
			const batchHistory = await benchmarkLogger.getBatchHistory(10);

			if (batchHistory.length === 0) {
				log.warning('No batch runs found');
				outro(chalk.yellow('Run some benchmarks first'));
				return;
			}

			const selectedBatch = await select({
				message: 'Choose a batch to view details:',
				options: batchHistory.map((batch, index) => ({
					value: batch.batchId,
					label: `${index + 1}. Batch ${batch.batchId.substring(0, 8)}... - ${batch.successfulRuns}/${batch.totalRuns} runs - ${batch.avgWeightedScore?.toFixed(4) || 'N/A'}`
				}))
			}) as string;

			// Execute batch stats
			const batchStats = await benchmarkLogger.getBatchDetails(selectedBatch);
			if (!batchStats) {
				log.error('Batch not found');
				return;
			}

			logger.stats.raw(chalk.bold.bgGreen(` Batch Details `));
			logger.stats.raw(`\n${chalk.gray('ID:')} ${chalk.dim(selectedBatch.substring(0, 8))}...`);
			logger.stats.raw(formatStats('Total Runs', batchStats.totalRuns ?? 0));
			logger.stats.raw(formatStats('Successful', batchStats.successfulRuns ?? 0, 'green'));
			logger.stats.raw(formatStats('Success Rate', `${(batchStats.totalRuns ?? 0) > 0 ? (((batchStats.successfulRuns ?? 0) / (batchStats.totalRuns ?? 1)) * 100).toFixed(1) : 0}%`, 'green'));
			logger.stats.raw(formatStats('Avg Score', (batchStats.avgScore ?? 0).toFixed(4), 'yellow'));
			logger.stats.raw(formatStats('Avg Weighted', (batchStats.avgWeightedScore ?? 0).toFixed(4), 'yellow'));
			logger.stats.raw(formatStats('Duration', `${((batchStats.duration ?? 0) / 1000).toFixed(2)}s`, 'blue'));
			logger.stats.raw(formatStats('Started', new Date(batchStats.createdAt).toLocaleString()));
			if (batchStats.completedAt) {
				logger.stats.raw(formatStats('Completed', new Date(batchStats.completedAt).toLocaleString()));
			}

			// Show runs in batch with ranking
			if (batchStats.runs && batchStats.runs.length > 0) {
				logger.stats.raw('\n' + chalk.underline('Runs in Batch'));
				const sortedRuns = batchStats.runs
					.filter(run => run.weightedScore !== null && run.weightedScore !== undefined)
					.sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0));

                sortedRuns.forEach((run, index) => {
					const rank = index + 1;
					const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
                    const status = run.status === 'completed'
                      ? chalk.green('✓')
                      : run.status === 'failed'
                      ? chalk.red('✗')
                      : run.status === 'running'
                      ? chalk.yellow('◐')
                      : chalk.blue('○');
					logger.stats.raw(`  ${rankDisplay} ${status} ${chalk.cyan(run.suite)}/${chalk.cyan(run.scenario)} ${chalk.gray(`(${run.tier})`)} ${chalk.cyan(run.agent)} ${chalk.yellow(run.weightedScore?.toFixed(4) || 'N/A')}`);
				});
		}

	} catch (error) {
		log.error(chalk.red('Failed to fetch batch statistics:'));
		logger.stats.debug(error instanceof Error ? error.message : String(error));
	} finally {
		benchmarkLogger.close();
	}
}

// ============================================================================
// INTERACTIVE EVALUATOR STATISTICS
// ============================================================================

export async function runInteractiveEvaluators() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		logger.stats.debug(`\nView in browser: ${serverUrl}`);
	} catch (err) {
		// Continue without web server
	}

	const benchmarkLogger = BenchmarkLogger.getInstance();

	try {
		intro(chalk.bgYellow(' Evaluator Performance '));

		const stats = await benchmarkLogger.getStats();

		if (!stats.evaluatorStats || Object.keys(stats.evaluatorStats).length === 0) {
			log.warning('No evaluator data available');
			outro(chalk.yellow('Run some benchmarks first'));
			return;
		}

		// Sort by performance
		const sorted = Object.entries(stats.evaluatorStats).sort((a, b) => {
			const aScore = (a[1] as { averageScore: number }).averageScore;
			const bScore = (b[1] as { averageScore: number }).averageScore;
			return bScore - aScore;
		});

		logger.stats.raw('\n' + chalk.underline('Performance Ranking'));
		sorted.forEach(([name, stat], index) => {
			const statObj = stat as { averageScore: number; count: number };
			const rank = index + 1;
			const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
			const percent = (statObj.averageScore * 100).toFixed(1);
			const color = statObj.averageScore >= 0.9 ? 'green' : statObj.averageScore >= 0.7 ? 'yellow' : 'red';

			logger.stats.raw(`  ${rankDisplay} ${chalk.bold(name.padEnd(30))} ${chalk[color](percent + '%')} ${chalk.gray(`(${statObj.count} runs)`)}`);
		});

		// Show best and worst performers
		const best = sorted[0];
		const worst = sorted[sorted.length - 1];
		const bestStat = best[1] as { averageScore: number };
		const worstStat = worst[1] as { averageScore: number };

		logger.stats.raw('\n' + chalk.underline('Performance Summary'));
		logger.stats.raw(`  ${chalk.green('Best:')} ${chalk.bold(best[0])} ${chalk.green((bestStat.averageScore * 100).toFixed(1) + '%')}`);
		logger.stats.raw(`  ${chalk.red('Needs Work:')} ${chalk.bold(worst[0])} ${chalk.red((worstStat.averageScore * 100).toFixed(1) + '%')}`);

		// Show model performance using common function
		// Note: getModelPerformanceStats requires a runId, but we don't have one here
		// This feature may need to be redesigned or we need to get a recent runId
		log.warning('Model performance stats require a specific runId - skipping');

		outro(chalk.green('Analysis complete'));

	} catch (error) {
		log.error(chalk.red('Failed to fetch evaluator data:'));
		logger.stats.debug(error instanceof Error ? error.message : String(error));
	} finally {
		benchmarkLogger.close();
	}
}
