import { intro, outro, select, isCancel, cancel, log } from '@clack/prompts';
import chalk from 'chalk';

// Import functions that will be called by the menu
// These imports will need to be adjusted based on the refactoring structure
import { runInteractiveBenchmark } from './benchmark.ts';
import { runInteractiveHistory, runInteractiveBatchHistory } from './history.ts';
import { runInteractiveSuiteStats, runInteractiveScenarioStats, runInteractiveRunStats, runInteractiveBatchStats, runInteractiveEvaluators } from './statistics.ts';
import { createNewSuite, createNewScenario } from './suite-management.ts';
import { runInteractiveClear } from './clear.ts';
import { showHelp } from '../cli/args.ts';
import { createTitle } from '../lib/display.ts';
import { validateEnvironment } from '../cli/environment.ts';

async function showInteractiveMenu() {
	// Check environment variables for interactive mode
	await validateEnvironment();

	console.log(chalk.cyan(createTitle()));
	intro(chalk.bgBlue(' Interactive Mode '));

	// Show web dashboard info
	console.log(`\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')} ${chalk.blue('http://localhost:3000')} ${chalk.gray('- Interactive charts and analytics')}`);
	console.log(`   ${chalk.gray('Run:')} ${chalk.yellow('pnpm dev')} ${chalk.gray('to start the web server')}\n`);

	while (true) {
		const action = await select({
			message: 'What would you like to do?',
			options: [
				{ value: 'benchmark-specialist', label: 'Run Benchmarks (Specialists)', hint: 'Recommended: Use pre-configured specialist templates' },
				{ value: 'benchmark-direct', label: 'Run Benchmarks (Direct Agents)', hint: 'Use base agents directly (openrouter, anthropic, etc.)' },
				{ value: 'history', label: 'History' },
				{ value: 'statistics', label: 'Statistics' },
				{ value: 'new-suite', label: 'Create New Suite' },
				{ value: 'new-scenario', label: 'Create New Scenario' },
				{ value: 'clear', label: 'Clear Database' },
				{ value: 'help', label: 'Show Help' },
				{ value: 'exit', label: 'Exit' }
			]
		});

		switch (action) {
			case 'benchmark-specialist':
				await runInteractiveBenchmark('specialist');
				break;
			case 'benchmark-direct':
				await runInteractiveBenchmark('direct');
				break;
			case 'history':
				await runInteractiveHistoryMenu();
				break;
			case 'statistics':
				await runInteractiveStatisticsMenu();
				break;
			case 'new-suite':
				await createNewSuite();
				break;
			case 'new-scenario':
				await createNewScenario();
				break;
			case 'clear':
				await runInteractiveClear();
				break;
			case 'help':
				showHelp();
				break;
			case 'exit':
				outro(chalk.green('Goodbye!'));
				process.exit(0);
				break;
		}

		// Add a small pause before showing the menu again
		console.log('\n');
	}
}

async function runInteractiveHistoryMenu() {
	const historyType = await select({
		message: 'What history would you like to view?',
		options: [
			{ value: 'run-history', label: 'Run History' },
			{ value: 'batch-history', label: 'Batch History' }
		]
	}) as string;

	switch (historyType) {
		case 'run-history':
			await runInteractiveHistory();
			break;
		case 'batch-history':
			await runInteractiveBatchHistory();
			break;
	}
}

async function runInteractiveStatisticsMenu() {
	const statsType = await select({
		message: 'What statistics would you like to view?',
		options: [
			{ value: 'suite-stats', label: 'Suite Statistics' },
			{ value: 'scenario-stats', label: 'Scenario Statistics' },
			{ value: 'run-stats', label: 'Run Details' },
			{ value: 'batch-stats', label: 'Batch Statistics' },
			{ value: 'evaluators', label: 'Evaluator Performance' }
		]
	}) as string;

	switch (statsType) {
		case 'suite-stats':
			await runInteractiveSuiteStats();
			break;
		case 'scenario-stats':
			await runInteractiveScenarioStats();
			break;
		case 'run-stats':
			await runInteractiveRunStats();
			break;
		case 'batch-stats':
			await runInteractiveBatchStats();
			break;
		case 'evaluators':
			await runInteractiveEvaluators();
			break;
	}
}

export { showInteractiveMenu, runInteractiveHistoryMenu, runInteractiveStatisticsMenu };
