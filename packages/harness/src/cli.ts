#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { EchoAgent, ClaudeCodeAdapter, AnthropicAdapter, type AgentAdapter } from '../../agent-adapters/src/index.ts';
import { runEvaluators } from '../../evaluators/src/index.ts';
import { runValidationCommands } from './runtime/validation.ts';
import { buildDiffArtifacts } from './runtime/diff.ts';
import { Oracle } from './runtime/oracle.ts';
import { createAskUserToolDefinition, createAskUserHandler } from './runtime/ask-user-tool.ts';
import { getAllWorkspaceTools, createWorkspaceToolHandlers } from './runtime/workspace-tools.ts';
import { BenchmarkLogger } from '@ze/database';
import { intro, outro, spinner, log, select, confirm } from '@clack/prompts';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import figlet from 'figlet';

// Utility functions for formatted output
function formatStats(label: string, value: string | number, color: 'green' | 'blue' | 'yellow' | 'red' = 'blue') {
  return `${chalk.gray(label)}: ${chalk[color](value)}`;
}

function createTitle() {
  return figlet.textSync('Ze Benchmarks', {
    font: 'ANSI Shadow',
    horizontalLayout: 'fitted',
    verticalLayout: 'default'
  });
}


function createHyperfineStyleBar() {
  return new cliProgress.SingleBar({
    format: chalk.white('{bar}') + ' | ETA {eta}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    clearOnComplete: false
  }, cliProgress.Presets.shades_classic);
}

function computeWeightedTotals(
	scores: Record<string, number>,
	scenarioCfg: { rubric_overrides?: { weights?: Record<string, number> } },
) {
	const baseWeights: Record<string, number> = {
		install_success: 1.5,
		tests_nonregression: 2.5,
		manager_correctness: 1,
		dependency_targets: 2,
		integrity_guard: 1.5,
	};

	const overrideWeights = scenarioCfg.rubric_overrides?.weights ?? {};

	let totalWeight = 0;
	let achieved = 0;

	for (const [metric, score] of Object.entries(scores || {})) {
		const weight = overrideWeights[metric] ?? baseWeights[metric] ?? 1;
		if (weight <= 0) continue;
		totalWeight += weight;
		achieved += (typeof score === 'number' ? score : 0) * weight;
	}

	const weighted = totalWeight > 0 ? (achieved / totalWeight) * 10 : 0;
	return { weighted: Number(weighted.toFixed(4)), max: 10 };
}

function findRepoRoot(): string {
	return resolve(fileURLToPath(import.meta.url), '../../../..');
}

function loadScenario(suite: string, scenario: string) {
	const root = findRepoRoot();
	const scenarioPath = join(root, 'suites', suite, 'scenarios', scenario, 'scenario.yaml');
	const yamlText = readFileSync(scenarioPath, 'utf8');
	return YAML.parse(yamlText);
}

function getScenarioDir(suite: string, scenario: string) {
	const root = findRepoRoot();
	return join(root, 'suites', suite, 'scenarios', scenario);
}

function prepareWorkspaceFromFixture(suite: string, scenario: string): { workspaceDir: string; fixtureDir: string } | undefined {
	const scenarioDir = getScenarioDir(suite, scenario);
	const candidates = ['repo', 'repo-fixture'];
	let fixtureDir: string | null = null;
	for (const name of candidates) {
		const dir = join(scenarioDir, name);
		if (existsSync(dir)) { fixtureDir = dir; break; }
	}
	if (!fixtureDir) {
		log.warning(`No raw fixture directory found (looked for ${candidates.join(', ')}) in ${scenarioDir}`);
		return;
	}
	const root = findRepoRoot();
	const workspacesDir = join(root, 'results', 'workspaces');
	mkdirSync(workspacesDir, { recursive: true });
	const workspaceDir = mkdtempSync(join(workspacesDir, `${suite}-${scenario}-`));
	try {
		cpSync(fixtureDir, workspaceDir, { recursive: true });
		return { workspaceDir, fixtureDir };
	} catch (err) {
		console.error('Failed to copy fixture directory:', err);
		return;
	}
}

function loadPrompt(suite: string, scenario: string, tier: string): string | null {
	const root = findRepoRoot();
	const promptDir = join(root, 'suites', suite, 'prompts', scenario);
	
	if (!existsSync(promptDir)) {
		log.warning(`Prompt directory not found: ${promptDir}`);
		return null;
	}
	
	// Look for files that start with the tier (e.g., L1-basic.md, L1.md)
	try {
		const files = readdirSync(promptDir);
		const promptFile = files.find((file: string) => file.startsWith(`${tier}-`) || file === `${tier}.md`);
		
		if (!promptFile) {
			log.warning(`No prompt file found for tier ${tier} in ${promptDir}`);
			return null;
		}
		
		const promptPath = join(promptDir, promptFile);
		return readFileSync(promptPath, 'utf8');
	} catch (err) {
		log.error('Failed to load prompt file:');
		console.error(chalk.dim(err instanceof Error ? err.message : String(err)));
		return null;
	}
}

function createAgentAdapter(agentName: string, model?: string, maxTurns?: number): AgentAdapter {
	switch (agentName) {
		case 'anthropic':
			return new AnthropicAdapter();
		case 'claude-code':
			return new ClaudeCodeAdapter(model, maxTurns ?? 10);
		case 'echo':
		default:
			return new EchoAgent();
	}
}

function writeResult(out: unknown, suite: string, scenario: string) {
	const root = findRepoRoot();
	const resultsDir = join(root, 'results');
	mkdirSync(resultsDir, { recursive: true });
	const outPath = join(resultsDir, `summary.json`);
	writeFileSync(outPath, JSON.stringify(out, null, 2));
	console.log(`Wrote results to ${outPath}`);
}


// for now I will leave this in might want to remove it if we don't need it at some point
function parseArgs(argv: string[]) {
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
	
	const cmd = 'bench';
	const suite = args[0];
	const scenario = args[1];
	const rest = args.slice(2);
	
	const tierIndex = rest.indexOf('--tier');
	const tier = tierIndex !== -1 ? rest[tierIndex + 1] : 'L0';
	
	const agentIndex = rest.indexOf('--agent');
	const agent = agentIndex !== -1 ? rest[agentIndex + 1] : 'echo';
	
	const modelIndex = rest.indexOf('--model');
	const model = modelIndex !== -1 ? rest[modelIndex + 1] : undefined;

	const maxTurnsIndex = rest.indexOf('--max-turns');
	const rawMaxTurns = maxTurnsIndex !== -1 ? Number.parseInt(rest[maxTurnsIndex + 1] ?? '', 10) : undefined;
	const maxTurns = typeof rawMaxTurns === 'number' && Number.isFinite(rawMaxTurns) && rawMaxTurns > 0 ? rawMaxTurns : undefined;

	const noJson = rest.includes('--no-json');

	return { cmd, suite, scenario, tier, agent, model, maxTurns, noJson } as const;
}

function showHelp() {
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
	console.log(`  ${chalk.cyan('--clear-db')}                    Clear database`);
	
	console.log('\n' + chalk.bold('Options:'));
	console.log(`  ${chalk.cyan('--tier')} <L0|L1|L2|L3>          Difficulty tier`);
	console.log(`  ${chalk.cyan('--agent')} <echo|anthropic>      Agent to use`);
	console.log(`  ${chalk.cyan('--model')} <name>                Model name`);
	console.log(`  ${chalk.cyan('--no-json')}                     Skip JSON output`);
	
	outro(chalk.gray('Run any command to get started'));
}

async function showInteractiveMenu() {
	// Check environment variables for interactive mode
	await validateEnvironment();
	
	console.log(chalk.cyan(createTitle()));
	intro(chalk.bgBlue(' Interactive Mode '));
	
	while (true) {
		const action = await select({
			message: 'What would you like to do?',
			options: [
				{ value: 'benchmark', label: 'Run a Benchmark' },
				{ value: 'history', label: 'View History' },
				{ value: 'stats', label: 'View Statistics' },
				{ value: 'evaluators', label: 'Evaluator Performance' },
				{ value: 'clear', label: 'Clear Database' },
				{ value: 'help', label: 'Show Help' },
				{ value: 'exit', label: 'Exit' }
			]
		});
		
		switch (action) {
			case 'benchmark':
				await runInteractiveBenchmark();
				break;
			case 'history':
				await runInteractiveHistory();
				break;
			case 'stats':
				await runInteractiveStats();
				break;
			case 'evaluators':
				await runInteractiveEvaluators();
				break;
			case 'clear':
				await runInteractiveClear();
				break;
			case 'help':
				showHelp();
				break;
			case 'exit':
				outro(chalk.green('Goodbye! 👋'));
				process.exit(0);
				break;
		}
		
		// Add a small pause before showing the menu again
		console.log('\n');
	}
}

async function runInteractiveBenchmark() {
	console.log(chalk.bold.underline('Demo: Benchmarking AI Agents:'));
	
	// Get available suites and scenarios
	const root = findRepoRoot();
	const suitesDir = join(root, 'suites');
	
	if (!existsSync(suitesDir)) {
		log.error(chalk.red('No suites directory found'));
		return;
	}
	
	const suites = readdirSync(suitesDir).filter(dir => 
		existsSync(join(suitesDir, dir, 'scenarios'))
	);
	
	if (suites.length === 0) {
		log.error(chalk.red('No suites found'));
		return;
	}
	
	// Select suite
	const selectedSuite = await select({
		message: 'Choose a suite:',
		options: suites.map(suite => ({ value: suite, label: suite }))
	}) as string;
	
	// Get scenarios for selected suite
	const scenariosDir = join(suitesDir, selectedSuite, 'scenarios');
	const scenarios = readdirSync(scenariosDir).filter(dir => 
		existsSync(join(scenariosDir, dir, 'scenario.yaml'))
	);
	
	if (scenarios.length === 0) {
		log.error(chalk.red('No scenarios found for this suite'));
		return;
	}
	
	// Select scenario
	const selectedScenario = await select({
		message: 'Choose a scenario:',
		options: scenarios.map(scenario => ({ value: scenario, label: scenario }))
	}) as string;
	
	// Select tier
	const tier = await select({
		message: 'Choose difficulty tier:',
		options: [
			{ value: 'L0', label: 'L0 - Minimal' },
			{ value: 'L1', label: 'L1 - Basic' },
			{ value: 'L2', label: 'L2 - Directed' },
			{ value: 'L3', label: 'L3 - Migration' },
			{ value: 'Lx', label: 'Lx - Adversarial' }
		]
	}) as string;
	
	// Select agent
	const agent = await select({
		message: 'Choose an agent:',
		options: [
			{ value: 'echo', label: 'Echo (Test Agent)' },
			{ value: 'anthropic', label: 'Anthropic Claude' },
			{ value: 'claude-code', label: 'Claude Code' }
		]
	}) as string;
	
	// Ask for model if needed
	let model = undefined;
	if (agent === 'anthropic' || agent === 'claude-code') {
		model = await select({
			message: 'Choose a model:',
			options: [
				{ value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Latest)' },
				{ value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
				{ value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' }
			]
		}) as string;
	}
	
	// Ask for max turns
	const maxTurns = await select({
		message: 'Choose maximum number of turns:',
		options: [
			{ value: 5, label: '5 turns (Quick)' },
			{ value: 10, label: '10 turns (Standard)' },
			{ value: 15, label: '15 turns (Extended)' },
			{ value: 20, label: '20 turns (Thorough)' }
		]
	}) as number;
	
	// Ask for JSON output
	const includeJson = await confirm({
		message: 'Include JSON output?',
		initialValue: true
	});
	
	// Show command that will be executed
	console.log(`\n${chalk.green('►')} ${chalk.green('pnpm bench')} ${chalk.yellow(`'${String(selectedSuite)}/${String(selectedScenario)}'`)} ${chalk.yellow(`'${String(tier)}'`)} ${chalk.yellow(`'${String(agent)}'`)} ${model ? chalk.yellow(`'${String(model)}'`) : ''} ${!includeJson ? '--no-json' : ''}`);
	
	// Show title before execution
	console.log(chalk.cyan(createTitle()));
	
	// Execute the benchmark
	await executeBenchmark(String(selectedSuite), String(selectedScenario), String(tier), String(agent), model, maxTurns, !includeJson);
}

async function runInteractiveHistory() {
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
		
		intro(chalk.bgCyan(' 📋 Benchmark History '));
		
		runHistory.forEach((run, index) => {
			const status = run.status === 'completed' 
				? chalk.green('✓') 
				: run.status === 'failed' 
				? chalk.red('✗') 
				: chalk.yellow('○');
			
			console.log(`\n${chalk.bold(`${index + 1}.`)} ${status} ${chalk.cyan(run.suite)}/${chalk.cyan(run.scenario)} ${chalk.gray(`(${run.tier})`)}`);
			console.log(`   ${formatStats('Agent', run.agent + (run.model ? ` (${run.model})` : ''))}`);
			console.log(`   ${formatStats('Score', run.weightedScore?.toFixed(4) || 'N/A', 'green')}`);
			console.log(`   ${chalk.gray(new Date(run.startedAt).toLocaleString())}`);
			console.log(`   ${chalk.dim(`ID: ${run.runId.substring(0, 8)}...`)}`);
		});
		
		outro(chalk.green(`Showing ${runHistory.length} recent runs`));
		
	} catch (error) {
		log.error(chalk.red('Failed to fetch history:'));
		console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
	} finally {
		logger.close();
	}
}

async function runInteractiveStats() {
	const logger = BenchmarkLogger.getInstance();
	
	try {
		const statsType = await select({
			message: 'What statistics would you like to see?',
			options: [
				{ value: 'suite', label: '📊 Suite Statistics' },
				{ value: 'scenario', label: '📈 Scenario Statistics' },
				{ value: 'run', label: '🔍 Run Details' }
			]
		}) as string;
		
		if (statsType === 'suite') {
			// Get available suites
			const root = findRepoRoot();
			const suitesDir = join(root, 'suites');
			const suites = readdirSync(suitesDir).filter(dir => 
				existsSync(join(suitesDir, dir, 'scenarios'))
			);
			
			const selectedSuite = await select({
				message: 'Choose a suite:',
				options: suites.map(suite => ({ value: suite, label: suite }))
			}) as string;
			
			// Execute suite stats
			const stats = logger.getSuiteStats(selectedSuite);
			console.log(chalk.bold.bgBlue(` 📊 Suite: ${selectedSuite} `));
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
			
		} else if (statsType === 'scenario') {
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
			console.log(chalk.bold.bgMagenta(` 📊 ${selectedSuite}/${selectedScenario} `));
			
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
					const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
					console.log(`  ${medal} ${chalk.cyan(agent.agent.padEnd(15))} ${chalk.yellow(agent.avgScore.toFixed(4))} ${chalk.gray(`(${agent.runs} runs)`)}`);
				});
			}
			
		} else if (statsType === 'run') {
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
			console.log(chalk.bold.bgGreen(` 🔍 Run Details `));
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
		}
		
	} catch (error) {
		log.error(chalk.red('Failed to fetch statistics:'));
		console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
	} finally {
		logger.close();
	}
}

async function runInteractiveEvaluators() {
	const logger = BenchmarkLogger.getInstance();
	
	try {
		intro(chalk.bgYellow(' 🎯 Evaluator Performance '));
		
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
			const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
			const percent = (stat.averageScore * 100).toFixed(1);
			const color = stat.averageScore >= 0.9 ? 'green' : stat.averageScore >= 0.7 ? 'yellow' : 'red';
			
			console.log(`  ${medal} ${chalk.bold(name.padEnd(30))} ${chalk[color](percent + '%')} ${chalk.gray(`(${stat.count} runs)`)}`);
		});
		
		// Show best and worst performers
		const best = sorted[0];
		const worst = sorted[sorted.length - 1];
		
		console.log('\n' + chalk.underline('Performance Summary'));
		console.log(`  ${chalk.green('🏆 Best:')} ${chalk.bold(best[0])} ${chalk.green((best[1].averageScore * 100).toFixed(1) + '%')}`);
		console.log(`  ${chalk.red('⚠️  Needs Work:')} ${chalk.bold(worst[0])} ${chalk.red((worst[1].averageScore * 100).toFixed(1) + '%')}`);
		
		// Show model performance
		const modelStats = logger.getModelPerformanceStats();
		if (modelStats.length > 0) {
			console.log('\n' + chalk.underline('Model Performance'));
			modelStats.forEach((model, index) => {
				const rank = index + 1;
				const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
				// Handle both decimal (0-1) and percentage (0-100) score formats
				const percent = model.avgScore > 1 ? model.avgScore.toFixed(1) : (model.avgScore * 100).toFixed(1);
				const scoreForColor = model.avgScore > 1 ? model.avgScore / 100 : model.avgScore;
				const color = scoreForColor >= 0.9 ? 'green' : scoreForColor >= 0.7 ? 'yellow' : 'red';
				
				console.log(`  ${medal} ${chalk.bold(model.model.padEnd(35))} ${chalk[color](percent + '%')} ${chalk.gray(`(${model.runs} runs)`)}`);
			});
			
			// Show best model
			const bestModel = modelStats[0];
			const bestPercent = bestModel.avgScore > 1 ? bestModel.avgScore.toFixed(1) : (bestModel.avgScore * 100).toFixed(1);
			console.log(`\n  ${chalk.cyan('🎯 Top Model:')} ${chalk.bold(bestModel.model)} ${chalk.green(bestPercent + '%')} ${chalk.gray(`(${bestModel.runs} runs)`)}`);
		}
		
		outro(chalk.green('Analysis complete'));
		
	} catch (error) {
		log.error(chalk.red('Failed to fetch evaluator data:'));
		console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
	} finally {
		logger.close();
	}
}

async function runInteractiveClear() {
	const logger = BenchmarkLogger.getInstance();
	
	try {
		intro(chalk.bgRed(' 🗑️  Clear Database '));
		
		// Get count before clearing
		const stats = logger.getStats();
		log.warning(`Found ${chalk.bold(stats.totalRuns)} benchmark runs`);
		
		const shouldClear = await confirm({
			message: 'Are you sure you want to clear all data?',
			initialValue: false
		});
		
		if (shouldClear) {
			const s = spinner();
			s.start('Clearing database...');
			logger.clearDatabase();
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

async function executeBenchmark(suite: string, scenario: string, tier: string, agent: string, model?: string, maxTurns?: number, noJson?: boolean) {
	// Initialize logger
	const logger = BenchmarkLogger.getInstance();
	const runId = logger.startRun(suite, scenario, tier, agent, model);
	const startTime = Date.now();
	
	// Load scenario with progress bar
	const scenarioCfg = loadScenario(suite, scenario);
	
	// Prepare workspace with progress bar
	const workspacePrep = prepareWorkspaceFromFixture(suite, scenario);
	const workspaceDir = workspacePrep?.workspaceDir;
	const fixtureDir = workspacePrep?.fixtureDir;
	
	// Show progress bar for workspace preparation
	if (workspaceDir) {
		const bar = createHyperfineStyleBar();
		bar.start(100, 0);
		
		// Simulate progress steps
		const steps = [
			'Loading scenario...',
			'Preparing workspace...',
			'Copying files...',
			'Setting up environment...',
			'Workspace ready'
		];
		
		const stepDelay = Math.max(100, 500 - (maxTurns || 10) * 20); // Faster for more turns
		
		for (let i = 0; i < steps.length; i++) {
			await new Promise(resolve => setTimeout(resolve, stepDelay));
			bar.update(Math.round(((i + 1) / steps.length) * 100));
		}
		
		bar.stop();
		console.log(`\n${chalk.green('✓')} ${steps[steps.length - 1]}`);
	}
	
	// Initialize result structure
	const result = {
		suite,
		scenario,
		tier,
		agent,
		model: model || 'default',
		agent_response: '',
		scores: {
			install_success: 0,
			tests_nonregression: 0,
			manager_correctness: 0,
			dependency_targets: 0,
			integrity_guard: 0,
		},
		totals: { weighted: 0, max: 10 },
		telemetry: { 
			toolCalls: 0, 
			tokens: { in: 0, out: 0 }, 
			cost_usd: 0, 
			workspaceDir 
		}
	};


	// Load prompt for the tier
	const promptContent = loadPrompt(suite, scenario, tier);
	
	if (promptContent && agent !== 'echo') {
		try {
			// Create agent adapter
			const agentAdapter = createAgentAdapter(agent, model, maxTurns);
			// Agent info is shown in progress bar
			
			// Load oracle if available
			let oracle: Oracle | undefined;
			const oracleFile = scenarioCfg.oracle?.answers_file;
			if (oracleFile) {
				const scenarioDir = getScenarioDir(suite, scenario);
				const oraclePath = join(scenarioDir, oracleFile);
				if (existsSync(oraclePath)) {
					oracle = new Oracle(oraclePath);
					// Oracle loaded
				}
			}
			
			// Build system prompt with tool usage guidance
			const systemPrompt = agent === 'anthropic' 
				? `You are working on a ${scenarioCfg.title}. The task is: ${scenarioCfg.description || 'Complete the development task.'}

IMPORTANT: You are working in the directory: ${workspaceDir}
This is a prepared workspace with the files you need to modify.

Available Tools:
- readFile: Read any file in the workspace
- writeFile: Modify files (e.g., package.json files)
- runCommand: Execute shell commands (e.g., pnpm install, pnpm outdated)
- listFiles: Explore directory structure
- askUser: Ask questions when you need clarification or approval for major changes

Work efficiently: read files to understand the current state, make necessary changes, run commands to validate, and ask questions only when truly needed for important decisions.`
				: `You are working on a ${scenarioCfg.title}. The task is: ${scenarioCfg.description || 'Complete the development task.'}\n\nIMPORTANT: You are working in the directory: ${workspaceDir}\nThis is a prepared workspace with the files you need to modify.`;
			
			// Build the request
			const request: any = {
				messages: [
					{
						role: 'system' as const,
						content: systemPrompt
					},
					{
						role: 'user' as const,
						content: promptContent
					}
				],
				workspaceDir,
				maxTurns
			};

			// Add tools if agent supports them (currently only Anthropic)
			if (agent === 'anthropic' && workspaceDir) {
				// Create workspace tool handlers
				const workspaceHandlers = createWorkspaceToolHandlers(workspaceDir);
				
				// Start with workspace tools
				const tools = getAllWorkspaceTools();
				const toolHandlers = workspaceHandlers;
				
				// Add askUser tool if oracle is available
				if (oracle) {
					tools.push(createAskUserToolDefinition());
					toolHandlers.set('askUser', createAskUserHandler(oracle));
					// Tools: readFile, writeFile, runCommand, listFiles, askUser
				} else {
					// Tools: readFile, writeFile, runCommand, listFiles
				}
				
				request.tools = tools;
				request.toolHandlers = toolHandlers;
			}

			// Execute agent request with progress bar
			const agentBar = createHyperfineStyleBar();
			agentBar.start(100, 0);
			
			// Simulate agent progress
			const agentSteps = [
				'Initializing agent...',
				'Sending request...',
				'Processing response...',
				'Agent response received'
			];
			
			const agentDelay = Math.max(50, 200 - (maxTurns || 10) * 10); // Faster for more turns
			
			for (let i = 0; i < agentSteps.length - 1; i++) {
				await new Promise(resolve => setTimeout(resolve, agentDelay));
				agentBar.update(Math.round(((i + 1) / (agentSteps.length - 1)) * 100));
			}
			
			const response = await agentAdapter.send(request);
			agentBar.stop();
			console.log(`\n${chalk.green('✓')} ${agentSteps[agentSteps.length - 1]}`);
			
			// Update result with agent response
			result.agent_response = response.content;
			result.telemetry.tokens.in = response.tokensIn || 0;
			result.telemetry.tokens.out = response.tokensOut || 0;
			result.telemetry.cost_usd = response.costUsd || 0;
			result.telemetry.toolCalls = response.toolCalls ?? 0;
			
			// Log telemetry to database
			const duration = Date.now() - startTime;
			logger.logTelemetry(
				response.toolCalls ?? 0,
				response.tokensIn || 0,
				response.tokensOut || 0,
				response.costUsd || 0,
				duration,
				workspaceDir
			);
			
			// Log oracle usage if available
			if (oracle) {
				const questionLog = oracle.getQuestionLog();
				if (questionLog.length > 0) {
					// Oracle questions logged
					(result as any).oracle_questions = questionLog;
				}
			}
			
			// Telemetry is shown in final results
			
		} catch (error) {
			log.error(chalk.red('Agent execution failed:'));
			console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
			result.agent_response = `Error: ${error instanceof Error ? error.message : String(error)}`;
		}
	} else if (!promptContent) {
		// No prompt loaded, skipping agent execution
	} else {
		// Using echo agent (no actual execution)
	}

	// Execute validation commands defined by scenario (install/test/lint/typecheck)
	const commandLog = workspaceDir ? runValidationCommands(workspaceDir, scenarioCfg.validation?.commands) : [];
	const diffArtifacts = workspaceDir && fixtureDir ? buildDiffArtifacts(fixtureDir, workspaceDir) : { diffSummary: [], depsDelta: [] };

	// Run evaluators with progress bar
	try {
		if (workspaceDir) {
			const bar = createHyperfineStyleBar();
			bar.start(100, 0);
			
			// Simulate evaluator progress
			const evaluatorSteps = [
				'Running install evaluator...',
				'Running test evaluator...',
				'Running package manager evaluator...',
				'Running dependency targets evaluator...',
				'Running integrity guard evaluator...',
				'Evaluators complete'
			];
			
			const evaluatorDelay = Math.max(100, 400 - (maxTurns || 10) * 15); // Faster for more turns
			
			for (let i = 0; i < evaluatorSteps.length - 1; i++) {
				await new Promise(resolve => setTimeout(resolve, evaluatorDelay));
				bar.update(Math.round(((i + 1) / (evaluatorSteps.length - 1)) * 100));
			}
			
			// Actually run evaluators
			const ctx = {
				scenario: scenarioCfg,
				workspaceDir,
				agentResponse: result.agent_response,
				commandLog,
				diffSummary: diffArtifacts.diffSummary,
				depsDelta: diffArtifacts.depsDelta,
			};
			const { scoreCard, results: evaluatorResults } = await runEvaluators(ctx);
			result.scores = { ...result.scores, ...scoreCard };
			result.totals = computeWeightedTotals(result.scores, scenarioCfg);
			(result as any).evaluator_results = evaluatorResults;
			(result as any).diff_summary = diffArtifacts.diffSummary;
			(result as any).deps_delta = diffArtifacts.depsDelta;
			
			// Log evaluation results to database
			for (const evalResult of evaluatorResults) {
				logger.logEvaluation(
					evalResult.name,
					evalResult.score,
					1.0, // max score
					evalResult.details
				);
			}
			
			bar.stop();
			console.log(`\n${chalk.green('✓')} ${evaluatorSteps[evaluatorSteps.length - 1]}`);
		}
	} catch (e) {
		// Evaluator run failed
	}

	// Complete the run in database
	const totalScore = Object.values(result.scores || {}).reduce((sum, score) => sum + (typeof score === 'number' ? score : 0), 0) / Object.keys(result.scores || {}).length;
	logger.completeRun(
		totalScore,
		result.totals?.weighted,
		{
			diffSummary: diffArtifacts.diffSummary,
			depsDelta: diffArtifacts.depsDelta,
			oracleQuestions: (result as any).oracle_questions
		}
	);

	// Display results in table format
	const duration = (Date.now() - startTime) / 1000;
	const weightedScore = result.totals?.weighted || 0;
	
	console.log(`\n${chalk.bold.underline('Benchmark Results')}`);
	console.log('┌─────────────────────────────────────────────────────────────┐');
	console.log(`│ ${chalk.bold('Agent:')} ${chalk.cyan(agent.padEnd(15))} ${chalk.bold('Tier:')} ${chalk.cyan(tier.padEnd(8))} ${chalk.bold('Duration:')} ${chalk.blue(duration.toFixed(2) + 's')} │`);
	console.log('├─────────────────────────────────────────────────────────────┤');
	console.log(`│ ${chalk.bold('Score (mean ± σ):')} ${chalk.green(weightedScore.toFixed(4))} ± ${chalk.green('0.0000')} ${chalk.gray('(out of 10.0)')} │`);
	console.log(`│ ${chalk.bold('Range (min ... max):')} ${chalk.green(weightedScore.toFixed(4))} ${chalk.white('...')} ${chalk.red(weightedScore.toFixed(4))} ${chalk.gray('(1 run)')} │`);
	console.log('└─────────────────────────────────────────────────────────────┘');
	
	// Print evaluation breakdown in table format
	if (result.scores) {
		console.log(`\n${chalk.bold.underline('Evaluation Breakdown')}`);
		console.log('┌─────────────────────────────────────────────────────────────┐');
		console.log(`│ ${chalk.bold('Evaluator'.padEnd(25))} ${chalk.bold('Score'.padEnd(10))} ${chalk.bold('Status'.padEnd(15))} │`);
		console.log('├─────────────────────────────────────────────────────────────┤');
		
		Object.entries(result.scores).forEach(([name, score]) => {
			const percent = (score as number) * 100;
			const color = percent >= 90 ? 'green' : percent >= 70 ? 'yellow' : 'red';
			const status = percent >= 90 ? '✓ Excellent' : percent >= 70 ? '⚠ Good' : '✗ Needs Work';
			const statusColor = percent >= 90 ? 'green' : percent >= 70 ? 'yellow' : 'red';
			
			console.log(`│ ${chalk.cyan(name.padEnd(25))} ${chalk[color](score.toFixed(4).padEnd(10))} ${chalk[statusColor](status.padEnd(15))} │`);
		});
		
		console.log('└─────────────────────────────────────────────────────────────┘');
	}

	// Print telemetry in table format
	if (result.telemetry) {
		console.log(`\n${chalk.bold.underline('Telemetry')}`);
		console.log('┌─────────────────────────────────────────────────────────────┐');
		console.log(`│ ${chalk.bold('Metric'.padEnd(20))} ${chalk.bold('Value'.padEnd(20))} ${chalk.bold('Unit'.padEnd(15))} │`);
		console.log('├─────────────────────────────────────────────────────────────┤');
		console.log(`│ ${chalk.cyan('Tool Calls'.padEnd(20))} ${chalk.green((result.telemetry.toolCalls || 0).toString().padEnd(20))} ${chalk.gray('calls'.padEnd(15))} │`);
		console.log(`│ ${chalk.cyan('Tokens In'.padEnd(20))} ${chalk.green((result.telemetry.tokens?.in || 0).toString().padEnd(20))} ${chalk.gray('tokens'.padEnd(15))} │`);
		console.log(`│ ${chalk.cyan('Tokens Out'.padEnd(20))} ${chalk.green((result.telemetry.tokens?.out || 0).toString().padEnd(20))} ${chalk.gray('tokens'.padEnd(15))} │`);
		console.log(`│ ${chalk.cyan('Cost'.padEnd(20))} ${chalk.green(`$${(result.telemetry.cost_usd || 0).toFixed(6)}`.padEnd(20))} ${chalk.gray('USD'.padEnd(15))} │`);
		console.log('└─────────────────────────────────────────────────────────────┘');
	}

	// Show database summary in table format
	try {
		const stats = logger.getStats();
		console.log(`\n${chalk.bold.underline('Database Summary')}`);
		console.log('┌─────────────────────────────────────────────────────────────┐');
		console.log(`│ ${chalk.bold('Metric'.padEnd(25))} ${chalk.bold('Value'.padEnd(20))} ${chalk.bold('Status'.padEnd(10))} │`);
		console.log('├─────────────────────────────────────────────────────────────┤');
		console.log(`│ ${chalk.cyan('Total Runs'.padEnd(25))} ${chalk.blue(stats.totalRuns.toString().padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log(`│ ${chalk.cyan('Success Rate'.padEnd(25))} ${chalk.green(`${(stats.successRate * 100).toFixed(1)}%`.padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log(`│ ${chalk.cyan('Average Score'.padEnd(25))} ${chalk.green(stats.averageWeightedScore.toFixed(4).padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log(`│ ${chalk.cyan('Database'.padEnd(25))} ${chalk.blue('results/benchmarks.db'.padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log('└─────────────────────────────────────────────────────────────┘');

	} catch (dbError) {
		log.warning(chalk.yellow('Database query failed:'));
		console.error(chalk.dim(dbError instanceof Error ? dbError.message : String(dbError)));
	}

	// Optionally write JSON
	if (!noJson) {
	writeResult(result, suite, scenario);
		console.log(`\n${chalk.green('✓')} Results saved to database and JSON`);
	} else {
		console.log(`\n${chalk.yellow('⚠')} JSON output disabled, results saved to database only`);
	}
	
	// Show completion outro
	console.log(`\n${chalk.green('✓')} Benchmark completed successfully`);
}

async function validateEnvironment() {
	const missingVars: string[] = [];
	
	// Check for ANTHROPIC_API_KEY if using anthropic or claude-code agents
	if (!process.env.ANTHROPIC_API_KEY) {
		missingVars.push('ANTHROPIC_API_KEY');
	}
	
	if (missingVars.length > 0) {
		console.log(chalk.red('❌ Missing required environment variables:'));
		console.log(chalk.yellow(`   ${missingVars.join(', ')}`));
		console.log('\n' + chalk.cyan('Setup Instructions:'));
		console.log(chalk.gray('1. Get your API key from: https://console.anthropic.com/settings/keys'));
		console.log(chalk.gray('2. Create a .env file in the project root:'));
		console.log(chalk.gray('   cp .env.example .env'));
		console.log(chalk.gray('3. Edit .env and add your API key:'));
		console.log(chalk.gray('   ANTHROPIC_API_KEY=your_key_here'));
		console.log(chalk.gray('4. Or set environment variables directly:'));
		console.log(chalk.gray('   Windows: set ANTHROPIC_API_KEY=your_key_here'));
		console.log(chalk.gray('   Linux/Mac: export ANTHROPIC_API_KEY=your_key_here'));
		console.log('\n' + chalk.red('Please set up your environment variables and try again.'));
		process.exit(1);
	}
}

async function run() {
	// Check for required environment variables first
	await validateEnvironment();
	
	const parsedArgs = parseArgs(process.argv);
	
	// If no arguments provided, show interactive menu
	if (process.argv.length <= 2) {
		await showInteractiveMenu();
		return;
	}
	
	// Handle stats command
	if (parsedArgs.cmd === 'stats') {
		const logger = BenchmarkLogger.getInstance();
		const { level, identifier } = parsedArgs;

		try {
			if (level === 'suite') {
				// Show suite-level stats
				const suiteName = identifier[0];
				if (!suiteName) {
					log.warning('Usage: pnpm bench --stats suite <suite-name>');
					return;
				}
				
				const stats = logger.getSuiteStats(suiteName);
				console.log(chalk.bold.bgBlue(` 📊 Suite: ${suiteName} `));
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
				
			} else if (level === 'scenario') {
				// Show scenario-level stats
				const [suite, scenario] = identifier;
				if (!suite || !scenario) {
					log.warning('Usage: pnpm bench --stats scenario <suite> <scenario>');
					return;
				}
				
				const stats = logger.getScenarioStats(suite, scenario);
				console.log(chalk.bold.bgMagenta(` 📊 ${suite}/${scenario} `));
				
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
						const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
						console.log(`  ${medal} ${chalk.cyan(agent.agent.padEnd(15))} ${chalk.yellow(agent.avgScore.toFixed(4))} ${chalk.gray(`(${agent.runs} runs)`)}`);
					});
				}
				
				if (stats.tierBreakdown.length > 0) {
					console.log('\n' + chalk.underline('Tier Breakdown'));
					stats.tierBreakdown.forEach(tier => {
						console.log(`  ${chalk.cyan('•')} ${chalk.bold(tier.tier)}: ${chalk.yellow(tier.avgScore.toFixed(4))} ${chalk.gray(`(${tier.runs} runs)`)}`);
					});
				}
				
			} else if (level === 'run') {
				// Show run-level stats
				const runId = identifier[0];
				if (!runId) {
					log.warning('Usage: pnpm bench --stats run <run-id>');
					return;
				}
				
				const stats = logger.getDetailedRunStats(runId);
				console.log(chalk.bold.bgGreen(` 🔍 Run Details `));
				console.log(`\n${chalk.gray('ID:')} ${chalk.dim(runId.substring(0, 8))}...`);
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
				
			} else {
				// Show usage
				log.warning('Usage: pnpm bench --stats <level> <identifier>');
				console.log('  pnpm bench --stats suite <suite-name>');
				console.log('  pnpm bench --stats scenario <suite> <scenario>');
				console.log('  pnpm bench --stats run <run-id>');
			}
		} catch (error) {
			log.error(chalk.red('Failed to fetch statistics:'));
			console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
			process.exit(1);
		} finally {
			logger.close();
		}
		return;
	}
	
	// Handle clear-db command
	if (parsedArgs.cmd === 'clear-db') {
		const logger = BenchmarkLogger.getInstance();
		
		intro(chalk.bgRed(' 🗑️  Clear Database '));
		
		try {
			// Get count before clearing
			const stats = logger.getStats();
			log.warning(`Found ${chalk.bold(stats.totalRuns)} benchmark runs`);
			
			const shouldClear = await confirm({
				message: 'Are you sure you want to clear all data?',
				initialValue: false
			});
			
			if (shouldClear) {
				const s = spinner();
				s.start('Clearing database...');
				logger.clearDatabase();
				s.stop('Database cleared');
				outro(chalk.green('✓ All data removed'));
			} else {
				outro(chalk.yellow('Cancelled'));
			}
			
		} catch (error) {
			log.error(chalk.red('Failed to clear database:'));
			console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
			process.exit(1);
		} finally {
			logger.close();
		}
		return;
	}
	
	// Handle evaluators command
	if (parsedArgs.cmd === 'evaluators') {
		const logger = BenchmarkLogger.getInstance();
		
		intro(chalk.bgYellow(' 🎯 Evaluator Performance '));
		
		try {
			const stats = logger.getStats();
			
			if (Object.keys(stats.evaluatorStats).length === 0) {
				log.warning('No evaluator data available');
				outro(chalk.yellow('Run some benchmarks first: pnpm bench <suite> <scenario>'));
				return;
			}
			
			// Sort by performance
			const sorted = Object.entries(stats.evaluatorStats).sort((a, b) => b[1].averageScore - a[1].averageScore);
			
			console.log('\n' + chalk.underline('Performance Ranking'));
			sorted.forEach(([name, stat], index) => {
				const rank = index + 1;
				const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
				const percent = (stat.averageScore * 100).toFixed(1);
				const color = stat.averageScore >= 0.9 ? 'green' : stat.averageScore >= 0.7 ? 'yellow' : 'red';
				
				console.log(`  ${medal} ${chalk.bold(name.padEnd(30))} ${chalk[color](percent + '%')} ${chalk.gray(`(${stat.count} runs)`)}`);
			});
			
			// Show best and worst performers
			const best = sorted[0];
			const worst = sorted[sorted.length - 1];
			
			console.log('\n' + chalk.underline('Performance Summary'));
			console.log(`  ${chalk.green('🏆 Best:')} ${chalk.bold(best[0])} ${chalk.green((best[1].averageScore * 100).toFixed(1) + '%')}`);
			console.log(`  ${chalk.red('⚠️  Needs Work:')} ${chalk.bold(worst[0])} ${chalk.red((worst[1].averageScore * 100).toFixed(1) + '%')}`);
			
			outro(chalk.green('Analysis complete'));
			
		} catch (error) {
			log.error(chalk.red('Failed to fetch evaluator data:'));
			console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
			process.exit(1);
		} finally {
			logger.close();
		}
		return;
	}
	
	// Handle history command
	if (parsedArgs.cmd === 'history') {
		const logger = BenchmarkLogger.getInstance();
		const limit = parsedArgs.limit;
		
		intro(chalk.bgCyan(' 📋 Benchmark History '));
		
		try {
			const runHistory = logger.getRunHistory(limit);
			
			if (runHistory.length === 0) {
				log.warning('No benchmark runs found');
				outro(chalk.yellow('Run a benchmark first: pnpm bench <suite> <scenario>'));
				return;
			}
			
			runHistory.forEach((run, index) => {
				const status = run.status === 'completed' 
					? chalk.green('✓') 
					: run.status === 'failed' 
					? chalk.red('✗') 
					: chalk.yellow('○');
				
				console.log(`\n${chalk.bold(`${index + 1}.`)} ${status} ${chalk.cyan(run.suite)}/${chalk.cyan(run.scenario)} ${chalk.gray(`(${run.tier})`)}`);
				console.log(`   ${formatStats('Agent', run.agent + (run.model ? ` (${run.model})` : ''))}`);
				console.log(`   ${formatStats('Score', run.weightedScore?.toFixed(4) || 'N/A', 'green')}`);
				console.log(`   ${chalk.gray(new Date(run.startedAt).toLocaleString())}`);
				console.log(`   ${chalk.dim(`ID: ${run.runId.substring(0, 8)}...`)}`);
			});
			
			// Show overall stats
			const stats = logger.getStats();
			console.log('\n' + chalk.underline('Overall Statistics'));
			console.log(formatStats('Total Runs', stats.totalRuns));
			console.log(formatStats('Success Rate', `${(stats.successRate * 100).toFixed(1)}%`, 'green'));
			console.log(formatStats('Avg Score', stats.averageScore.toFixed(4), 'yellow'));
			console.log(formatStats('Avg Weighted', stats.averageWeightedScore.toFixed(4), 'yellow'));
			console.log(formatStats('Avg Duration', `${(stats.averageDuration / 1000).toFixed(2)}s`, 'blue'));
			
			outro(chalk.green(`Showing ${runHistory.length} recent runs`));
			
		} catch (error) {
			log.error(chalk.red('Failed to fetch history:'));
			console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
			process.exit(1);
		} finally {
			logger.close();
		}
		return;
	}
	
	const { cmd, suite, scenario, tier, agent, model, maxTurns, noJson } = parsedArgs;
	if (cmd !== 'bench' || !suite || !scenario) {
		showHelp();
		process.exit(1);
	}
	
	// Show modern CLI intro with hyperfine-style header
	console.log(chalk.bold.underline('Demo: Benchmarking AI Agents:'));
	console.log(`\n${chalk.green('►')} ${chalk.green('pnpm bench')} ${chalk.yellow(`'${suite}/${scenario}'`)} ${chalk.yellow(`'${tier}'`)} ${chalk.yellow(`'${agent}'`)}`);
	
	log.info(chalk.bold(`Running: ${suite}/${scenario}`));
	log.info(`${chalk.gray('Tier:')} ${chalk.cyan(tier)} ${chalk.gray('Agent:')} ${chalk.cyan(agent)}`);
	
	// Execute the benchmark
	await executeBenchmark(suite, scenario, tier, agent, model, maxTurns, noJson);
}

run().catch((err) => {
	console.log(`\n${chalk.red('✗')} Benchmark failed: ${err instanceof Error ? err.message : String(err)}`);
	
	// Try to log the error to database if logger is available
	try {
		const logger = BenchmarkLogger.getInstance();
		logger.failRun(String(err));
	} catch (logErr) {
		console.log(`${chalk.yellow('⚠')} Failed to log error to database: ${logErr instanceof Error ? logErr.message : String(logErr)}`);
	}
	
	process.exit(1);
});
