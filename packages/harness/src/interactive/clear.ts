import { intro, outro, spinner, log, confirm } from '@clack/prompts';
import chalk from 'chalk';
import { BenchmarkLogger } from '@ze/worker-client';

async function runInteractiveClear() {
	const logger = BenchmarkLogger.getInstance();

	try {
		intro(chalk.bgRed(' Clear Database '));

		// Get count before clearing
		const stats = await logger.getStats();
		log.warning(`Found ${chalk.bold(stats.totalRuns || 0)} benchmark runs`);

		const shouldClear = await confirm({
			message: 'Are you sure you want to clear all data?',
			initialValue: false
		});

		if (shouldClear) {
			const s = spinner();
			s.start('Clearing database...');
			await logger.clearDatabase();
			s.stop('Database cleared');
			outro(chalk.green('✓ All data removed'));
		} else {
			outro(chalk.yellow('Cancelled'));
		}

	} catch (error) {
		log.error(chalk.red('Failed to clear database:'));
		console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
	} finally {
		logger.close();
	}
}

export { runInteractiveClear };
