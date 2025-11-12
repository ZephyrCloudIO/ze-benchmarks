import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { select, intro, outro, log } from '@clack/prompts';
import chalk from 'chalk';
import { BenchmarkLogger } from '@ze/database';
import { startDevServer } from '../dev-server.ts';
import { findRepoRoot } from '../lib/workspace-utils.ts';
import { formatStats, displayModelPerformance } from '../lib/display.ts';

// ============================================================================
// INTERACTIVE SUITE STATISTICS
// ============================================================================

export async function runInteractiveSuiteStats() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		console.log(`\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')}`);
		console.log(`   ${chalk.blue.underline(serverUrl)} ${chalk.gray('- Click to open interactive dashboard')}`);
		console.log(`   ${chalk.gray('Features: Charts, analytics, batch comparison, and detailed run analysis')}`);
	} catch (err) {
		// Continue without web server
		console.log(chalk.yellow('⚠ Web server not available, showing CLI statistics only'));
	}

	const logger = BenchmarkLogger.getInstance();

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
			const stats = logger.getSuiteStats(selectedSuite);
		console.log(chalk.bold.bgBlue(` Suite: ${selectedSuite} `));
			console.log('\n' + chalk.underline('Overview'));
			console.log(formatStats('Total Runs', stats.totalRuns));
			console.log(formatStats('Success Rate', `${stats.totalRuns > 0 ? ((stats.successfulRuns / stats.totalRuns) * 100).toFixed(1) : 0}%`, 'green'));
			console.log(formatStats('Avg Score', stats.avgScore.toFixed(4), 'yellow'));
			console.log(formatStats('Avg Weighted', stats.avgWeightedScore.toFixed(4), 'yellow'));
			console.log(formatStats('Avg Duration', `${(stats.avgDuration / 1000).toFixed(2)}s`, 'blue'));

			if (stats.scenarioBreakdown.length > 0) {
				console.log('\n' + chalk.underline('Scenario Breakdown'));
				stats.scenarioBreakdown.forEach(scenario => {
					console.log(`  ${chalk.cyan('•')} ${chalk.bold(scenario.scenario)}: ${chalk.yellow(scenario.avgScore.toFixed(4))} ${chalk.gray(`(${scenario.runs} runs)`)}`);
				});
			}

	} catch (error) {
		log.error(chalk.red('Failed to fetch suite statistics:'));
		console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
	} finally {
		logger.close();
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
		console.log(`\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')}`);
		console.log(`   ${chalk.blue.underline(serverUrl)} ${chalk.gray('- Click to open interactive dashboard')}`);
		console.log(`   ${chalk.gray('Features: Charts, analytics, batch comparison, and detailed run analysis')}`);
	} catch (err) {
		// Continue without web server
		console.log(chalk.yellow('⚠ Web server not available, showing CLI statistics only'));
	}

	const logger = BenchmarkLogger.getInstance();

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
			const stats = logger.getScenarioStats(selectedSuite, selectedScenario);
		console.log(chalk.bold.bgMagenta(` ${selectedSuite}/${selectedScenario} `));

			// Score range with visual bar
			const scorePercent = (stats.avgWeightedScore / 10) * 100;
			const barLength = 20;
			const filled = Math.round((scorePercent / 100) * barLength);
			const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(barLength - filled));
			console.log(`\n${bar} ${chalk.bold(stats.avgWeightedScore.toFixed(2))}/10`);

			console.log('\n' + chalk.underline('Overview'));
			console.log(formatStats('Total Runs', stats.totalRuns));
			console.log(formatStats('Success Rate', `${stats.totalRuns > 0 ? ((stats.successfulRuns / stats.totalRuns) * 100).toFixed(1) : 0}%`, 'green'));
			console.log(formatStats('Avg Score', stats.avgScore.toFixed(4), 'yellow'));
			console.log(formatStats('Score Range', `${stats.minScore.toFixed(4)} - ${stats.maxScore.toFixed(4)}`, 'blue'));

			// Agent comparison table
			if (stats.agentComparison.length > 0) {
				console.log('\n' + chalk.underline('Agent Performance'));
				stats.agentComparison.forEach((agent, i) => {
					const rank = i + 1;
					const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
					console.log(`  ${rankDisplay} ${chalk.cyan(agent.agent.padEnd(15))} ${chalk.yellow(agent.avgScore.toFixed(4))} ${chalk.gray(`(${agent.runs} runs)`)}`);
				});
			}

	} catch (error) {
		log.error(chalk.red('Failed to fetch scenario statistics:'));
		console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
	} finally {
		logger.close();
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
		console.log(`\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')}`);
		console.log(`   ${chalk.blue.underline(serverUrl)} ${chalk.gray('- Click to open interactive dashboard')}`);
		console.log(`   ${chalk.gray('Features: Charts, analytics, batch comparison, and detailed run analysis')}`);
	} catch (err) {
		// Continue without web server
		console.log(chalk.yellow('⚠ Web server not available, showing CLI statistics only'));
	}

	const logger = BenchmarkLogger.getInstance();

	try {
			// Get recent runs to choose from
			const runHistory = logger.getRunHistory(10);

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
			const stats = logger.getDetailedRunStats(selectedRun);
		console.log(chalk.bold.bgGreen(` Run Details `));
			console.log(`\n${chalk.gray('ID:')} ${chalk.dim(selectedRun.substring(0, 8))}...`);
			console.log(formatStats('Suite', stats.run.suite));
			console.log(formatStats('Scenario', stats.run.scenario));
			console.log(formatStats('Tier', stats.run.tier));
			console.log(formatStats('Agent', stats.run.agent + (stats.run.model ? ` (${stats.run.model})` : '')));
			console.log(formatStats('Status', stats.run.status, stats.run.status === 'completed' ? 'green' : stats.run.status === 'failed' ? 'red' : 'yellow'));
			console.log(formatStats('Started', new Date(stats.run.startedAt).toLocaleString()));
			if (stats.run.completedAt) {
				console.log(formatStats('Completed', new Date(stats.run.completedAt).toLocaleString()));
			}
			if (stats.run.totalScore !== null && stats.run.totalScore !== undefined) {
				console.log(formatStats('Total Score', stats.run.totalScore.toFixed(4), 'green'));
			}
			if (stats.run.weightedScore !== null && stats.run.weightedScore !== undefined) {
				console.log(formatStats('Weighted Score', stats.run.weightedScore.toFixed(4), 'green'));
			}

			// Evaluation breakdown with progress bars
			if (stats.evaluationBreakdown.length > 0) {
				console.log('\n' + chalk.underline('Evaluations'));
				stats.evaluationBreakdown.forEach(evaluation => {
					const percent = evaluation.percentage;
					const color = percent === 100 ? 'green' : percent >= 80 ? 'yellow' : 'red';
					const barLength = 15;
					const filled = Math.round((percent / 100) * barLength);
					const bar = chalk[color]('█'.repeat(filled)) + chalk.gray('░'.repeat(barLength - filled));

					console.log(`  ${evaluation.name.padEnd(30)} ${bar} ${chalk[color](percent.toFixed(1) + '%')}`);
				});
			}

			if (stats.telemetrySummary) {
				console.log('\n' + chalk.underline('Telemetry'));
				console.log(formatStats('Tool Calls', stats.telemetrySummary.toolCalls, 'blue'));
				console.log(formatStats('Tokens', stats.telemetrySummary.tokens, 'blue'));
				console.log(formatStats('Cost', `$${stats.telemetrySummary.cost.toFixed(6)}`, 'blue'));
				console.log(formatStats('Duration', `${(stats.telemetrySummary.duration / 1000).toFixed(2)}s`, 'blue'));
			}

	} catch (error) {
		log.error(chalk.red('Failed to fetch run statistics:'));
		console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
	} finally {
		logger.close();
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
		console.log(chalk.gray(`\nView in browser: ${serverUrl}`));
	} catch (err) {
		// Continue without web server
	}

	const logger = BenchmarkLogger.getInstance();

	try {
			// Get recent batches to choose from
			const batchHistory = logger.getBatchHistory(10);

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
			const batchStats = logger.getBatchDetails(selectedBatch);
			if (!batchStats) {
				log.error('Batch not found');
				return;
			}

		console.log(chalk.bold.bgGreen(` Batch Details `));
			console.log(`\n${chalk.gray('ID:')} ${chalk.dim(selectedBatch.substring(0, 8))}...`);
			console.log(formatStats('Total Runs', batchStats.totalRuns));
			console.log(formatStats('Successful', batchStats.successfulRuns, 'green'));
			console.log(formatStats('Success Rate', `${batchStats.totalRuns > 0 ? ((batchStats.successfulRuns / batchStats.totalRuns) * 100).toFixed(1) : 0}%`, 'green'));
			console.log(formatStats('Avg Score', batchStats.avgScore.toFixed(4), 'yellow'));
			console.log(formatStats('Avg Weighted', batchStats.avgWeightedScore.toFixed(4), 'yellow'));
			console.log(formatStats('Duration', `${(batchStats.duration / 1000).toFixed(2)}s`, 'blue'));
			console.log(formatStats('Started', new Date(batchStats.createdAt).toLocaleString()));
			if (batchStats.completedAt) {
				console.log(formatStats('Completed', new Date(batchStats.completedAt).toLocaleString()));
			}

			// Show runs in batch with ranking
			if (batchStats.runs.length > 0) {
				console.log('\n' + chalk.underline('Runs in Batch'));
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
                      : run.status === 'incomplete'
                      ? chalk.yellow('◐')
                      : chalk.blue('○');
					console.log(`  ${rankDisplay} ${status} ${chalk.cyan(run.suite)}/${chalk.cyan(run.scenario)} ${chalk.gray(`(${run.tier})`)} ${chalk.cyan(run.agent)} ${chalk.yellow(run.weightedScore?.toFixed(4) || 'N/A')}`);
				});
		}

	} catch (error) {
		log.error(chalk.red('Failed to fetch batch statistics:'));
		console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
	} finally {
		logger.close();
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
		console.log(chalk.gray(`\nView in browser: ${serverUrl}`));
	} catch (err) {
		// Continue without web server
	}

	const logger = BenchmarkLogger.getInstance();

	try {
		intro(chalk.bgYellow(' Evaluator Performance '));

		const stats = logger.getStats();

		if (Object.keys(stats.evaluatorStats).length === 0) {
			log.warning('No evaluator data available');
			outro(chalk.yellow('Run some benchmarks first'));
			return;
		}

		// Sort by performance
		const sorted = Object.entries(stats.evaluatorStats).sort((a, b) => b[1].averageScore - a[1].averageScore);

		console.log('\n' + chalk.underline('Performance Ranking'));
		sorted.forEach(([name, stat], index) => {
			const rank = index + 1;
			const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
			const percent = (stat.averageScore * 100).toFixed(1);
			const color = stat.averageScore >= 0.9 ? 'green' : stat.averageScore >= 0.7 ? 'yellow' : 'red';

			console.log(`  ${rankDisplay} ${chalk.bold(name.padEnd(30))} ${chalk[color](percent + '%')} ${chalk.gray(`(${stat.count} runs)`)}`);
		});

		// Show best and worst performers
		const best = sorted[0];
		const worst = sorted[sorted.length - 1];

		console.log('\n' + chalk.underline('Performance Summary'));
		console.log(`  ${chalk.green('Best:')} ${chalk.bold(best[0])} ${chalk.green((best[1].averageScore * 100).toFixed(1) + '%')}`);
		console.log(`  ${chalk.red('Needs Work:')} ${chalk.bold(worst[0])} ${chalk.red((worst[1].averageScore * 100).toFixed(1) + '%')}`);

		// Show model performance using common function
		const modelStats = logger.getModelPerformanceStats();
		displayModelPerformance(modelStats);

		outro(chalk.green('Analysis complete'));

	} catch (error) {
		log.error(chalk.red('Failed to fetch evaluator data:'));
		console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
	} finally {
		logger.close();
	}
}
