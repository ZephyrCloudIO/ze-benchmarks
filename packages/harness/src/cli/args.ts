import chalk from 'chalk';
import { intro, outro } from '@clack/prompts';
import { createTitle } from '../lib/display.ts';

// ============================================================================
// COMMAND-LINE ARGUMENT PARSING
// ============================================================================

export function parseArgs(argv: string[]) {
	// Skip node, script path - arguments are directly suite and scenario
	const args = argv.slice(2);

	// Check for history command
	if (args[0] === '--history') {
		const limit = args[1] ? parseInt(args[1], 10) : 10;
		return { cmd: 'history', limit: isNaN(limit) ? 10 : limit } as const;
	}

	// Check for evaluators command
	if (args[0] === '--evaluators') {
		return { cmd: 'evaluators' } as const;
	}

	// Check for clear-db command
	if (args[0] === '--clear-db') {
		return { cmd: 'clear-db' } as const;
	}

	// Check for stats command
	if (args[0] === '--stats') {
		const level = args[1]; // 'run', 'suite', or 'scenario'
		const identifier = args.slice(2); // suite name, scenario name, or run ID
		return { cmd: 'stats', level, identifier } as const;
	}

	// Check for batches command
	if (args[0] === '--batches') {
		const limit = args[1] ? parseInt(args[1], 10) : 20;
		return { cmd: 'batches', limit: isNaN(limit) ? 20 : limit } as const;
	}

	// Check for batch-details command
	if (args[0] === '--batch-details') {
		const batchId = args[1];
		return { cmd: 'batch-details', batchId } as const;
	}

	// Check for compare-batches command
	if (args[0] === '--compare-batches') {
		const batchIds = args.slice(1);
		return { cmd: 'compare-batches', batchIds } as const;
	}

	// Check for new-suite command
	if (args[0] === '--new-suite') {
		const name = args[1];
		return { cmd: 'new-suite', name } as const;
	}

	// Check for new-scenario command
	if (args[0] === '--new-scenario') {
		const suite = args[1];
		const name = args[2];
		return { cmd: 'new-scenario', suite, name } as const;
	}

	const cmd = 'bench';
	const suite = args[0];
	const scenario = args[1];
	const rest = args.slice(2);

	const tierIndex = rest.indexOf('--tier');
	const tier = tierIndex !== -1 ? rest[tierIndex + 1] : 'L0';

	const specialistIndex = rest.indexOf('--specialist');
	const specialist = specialistIndex !== -1 ? rest[specialistIndex + 1] : undefined;

	const agentIndex = rest.indexOf('--agent');
	// If specialist is provided, agent can be undefined (will be auto-detected)
	// Otherwise, default to 'echo'
	const agent = agentIndex !== -1 ? rest[agentIndex + 1] : (specialist ? undefined : 'echo');

	const modelIndex = rest.indexOf('--model');
	const model = modelIndex !== -1 ? rest[modelIndex + 1] : undefined;

	const batchIdIndex = rest.indexOf('--batch-id');
	const batchId = batchIdIndex !== -1 ? rest[batchIdIndex + 1] : undefined;

	const enrichTemplateIndex = rest.indexOf('--enrich-template');
	const enrichTemplate = enrichTemplateIndex !== -1 ? rest[enrichTemplateIndex + 1] : undefined;

	const iterationsIndex = rest.indexOf('--iterations');
	const iterations = iterationsIndex !== -1 ? parseInt(rest[iterationsIndex + 1], 10) || 1 : 1;

	const skipWarmup = rest.includes('--skip-warmup');
	const warmupOnly = rest.includes('--warmup-only');
	const quiet = rest.includes('--quiet');
	const llmJudgeOnly = rest.includes('--llm-judge-only');

	return { cmd, suite, scenario, tier, agent, model, batchId, specialist, skipWarmup, warmupOnly, quiet, llmJudgeOnly, enrichTemplate, iterations } as const;
}

export function showHelp() {
	console.log(chalk.cyan(createTitle()));
	intro(chalk.bgBlue(' CLI Help '));

	console.log('\n' + chalk.bold('Usage:'));
	console.log(`  ${chalk.cyan('pnpm bench')} <suite> <scenario> [options]`);

	console.log('\n' + chalk.bold('Commands:'));
	console.log(`  ${chalk.cyan('--history')} [limit]              Show recent runs`);
	console.log(`  ${chalk.cyan('--evaluators')}                  Show evaluator stats`);
	console.log(`  ${chalk.cyan('--stats')} suite <name>          Suite statistics`);
	console.log(`  ${chalk.cyan('--stats')} scenario <s> <sc>     Scenario statistics`);
	console.log(`  ${chalk.cyan('--stats')} run <id>              Run details`);
	console.log(`  ${chalk.cyan('--batches')} [limit]             List recent batches`);
	console.log(`  ${chalk.cyan('--batch-details')} <id>          Detailed batch analytics`);
	console.log(`  ${chalk.cyan('--compare-batches')} <id1> <id2> Compare multiple batches`);
	console.log(`  ${chalk.cyan('--new-suite')} [name]            Create a new benchmark suite`);
	console.log(`  ${chalk.cyan('--new-scenario')} [suite] [name] Create a new scenario in a suite`);
	console.log(`  ${chalk.cyan('--clear-db')}                    Clear database`);

	console.log('\n' + chalk.bold('Options:'));
	console.log(`  ${chalk.cyan('--tier')} <tier>                   Difficulty tier (varies by scenario)`);
	console.log(`  ${chalk.cyan('--agent')} <echo|anthropic|openrouter|claude-code>      Agent to use`);
	console.log(`  ${chalk.cyan('--model')} <name>                Model name`);
	console.log(`  ${chalk.cyan('--specialist')} <name>          Specialist name (e.g., @zephyr-cloud/shadcn-specialist)`);
	console.log(`  ${chalk.cyan('--batch-id')} <id>              Batch ID for grouping runs`);
	console.log(`  ${chalk.cyan('--iterations')} <n>             Number of times to run benchmark (default: 1)`);
	console.log(`  ${chalk.cyan('--enrich-template')} <path>     Template path to enrich after benchmarks`);
	console.log(`  ${chalk.cyan('--skip-warmup')}                  Skip warmup phase (for parallel execution)`);
	console.log(`  ${chalk.cyan('--warmup-only')}                  Run warmup phase only (for manual validation)`);
	console.log(`  ${chalk.cyan('--quiet')}                        Minimal output (for parallel execution)`);
	console.log(`  ${chalk.cyan('--llm-judge-only')}               Only run LLM judge evaluator (skip other evaluators)`);

	console.log('\n' + chalk.bold('Model Selection:'));
	console.log(`  ${chalk.cyan('OpenRouter Models:')} Search-based selection from 200+ models`);
	console.log(`  ${chalk.gray('Search by:')} model name, provider, or description`);
	console.log(`  ${chalk.gray('Example searches:')} "gpt-4o", "llama-3", "gemma free", "claude sonnet"`);

	console.log('\n' + chalk.bold('Web Dashboard:'));
	console.log(`  ${chalk.blue('http://localhost:3000')} ${chalk.gray('- Interactive charts and analytics')}`);
	console.log(`  ${chalk.gray('Run:')} ${chalk.yellow('pnpm dev')} ${chalk.gray('to start the web server')}`);

	outro(chalk.gray('Run any command to get started'));
}
