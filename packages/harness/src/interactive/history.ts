import { select, intro, outro, log } from '@clack/prompts';
import chalk from 'chalk';
import { BenchmarkLogger } from '@ze/worker-client';
import { startDevServer } from '../dev-server.ts';
import { displayRunInfo, formatStats } from '../lib/display.ts';

// ============================================================================
// INTERACTIVE RUN HISTORY
// ============================================================================

export async function runInteractiveHistory() {
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
		const limit = await select({
			message: 'How many recent runs to show?',
			options: [
				{ value: 5, label: '5 runs' },
				{ value: 10, label: '10 runs' },
				{ value: 20, label: '20 runs' },
				{ value: 50, label: '50 runs' }
			]
		}) as number;

		// Execute history command
		const runHistory = logger.getRunHistory(limit);

		if (runHistory.length === 0) {
			log.warning('No benchmark runs found');
			outro(chalk.yellow('Run a benchmark first'));
			return;
		}

		intro(chalk.bgCyan(' Benchmark History '));

		// Use common display function
		runHistory.forEach((run, index) => displayRunInfo(run, index));

		outro(chalk.green(`Showing ${runHistory.length} recent runs`));

	} catch (error) {
		log.error(chalk.red('Failed to fetch history:'));
		console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
	} finally {
		logger.close();
	}
}

// ============================================================================
// INTERACTIVE BATCH HISTORY
// ============================================================================

export async function runInteractiveBatchHistory() {
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
		const limit = await select({
			message: 'How many recent batches to show?',
			options: [
				{ value: 5, label: '5 batches' },
				{ value: 10, label: '10 batches' },
				{ value: 20, label: '20 batches' },
				{ value: 50, label: '50 batches' }
			]
		}) as number;

		// Execute batch history command
		const batchHistory = logger.getBatchHistory(limit);

		if (batchHistory.length === 0) {
			log.warning('No batch runs found');
			outro(chalk.yellow('Run some benchmarks first'));
			return;
		}

		intro(chalk.bgCyan(' Batch History '));

		batchHistory.forEach((batch, index) => {
			const status = batch.completedAt
				? chalk.green('✓')
				: chalk.yellow('○');

			console.log(`\n${chalk.bold(`${index + 1}.`)} ${status} ${chalk.cyan('Batch')} ${chalk.dim(batch.batchId.substring(0, 8))}...`);
			console.log(`   ${formatStats('Runs', `${batch.successfulRuns}/${batch.totalRuns}`, 'green')}`);
			console.log(`   ${formatStats('Avg Score', batch.avgWeightedScore?.toFixed(4) || 'N/A', 'yellow')}`);
			console.log(`   ${chalk.gray(new Date(batch.createdAt).toLocaleString())}`);
			if (batch.completedAt) {
				const duration = (batch.completedAt - batch.createdAt) / 1000;
				console.log(`   ${formatStats('Duration', `${duration.toFixed(2)}s`, 'blue')}`);
			}
		});

		outro(chalk.green(`Showing ${batchHistory.length} recent batches`));

	} catch (error) {
		log.error(chalk.red('Failed to fetch batch history:'));
		console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
	} finally {
		logger.close();
	}
}
