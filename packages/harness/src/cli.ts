#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { EchoAgent, ClaudeCodeAdapter, OpenRouterAdapter, AnthropicAdapter, type AgentAdapter, type AgentRequest } from '../../agent-adapters/src/index.ts';
import { OpenAI } from 'openai';
import { runEvaluators } from '../../evaluators/src/index.ts';
import { runValidationCommands } from './runtime/validation.ts';
import { buildDiffArtifacts } from './runtime/diff.ts';
import { Oracle } from './runtime/oracle.ts';
import { createAskUserToolDefinition, createAskUserHandler } from './runtime/ask-user-tool.ts';
import { getAllWorkspaceTools, createWorkspaceToolHandlers } from './runtime/workspace-tools.ts';
import { BenchmarkLogger } from '@ze/database';
import { intro, outro, spinner, log, select, confirm, multiselect, isCancel, cancel, text } from '@clack/prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import { startDevServer, getServerUrl, stopDevServer } from './dev-server.ts';
import { OpenRouterAPI } from './lib/openrouter-api.ts';

// ============================================================================
// DYNAMIC MODEL LOADING
// ============================================================================

async function getAvailableAgents(): Promise<Array<{value: string, label: string}>> {
  const agents = [
    { value: '__ALL__', label: 'All agents' },
    { value: 'echo', label: 'Echo (Test Agent)' },
    { value: 'openrouter', label: 'OpenRouter (Any Model)' },
    { value: 'anthropic', label: 'Anthropic Claude (Direct API)' },
    { value: 'claude-code', label: 'Claude Code' }
  ];
  
  return agents;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TABLE_WIDTH = 60;
const SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 70,
  NEEDS_WORK: 60
} as const;

// Simple progress state and helpers
const TOTAL_STAGES = 6;

interface ProgressState {
  spinner: any;
  currentStage: number;
}

function createProgress(): ProgressState {
  return {
    spinner: spinner(),
    currentStage: 0
  };
}

function updateProgress(state: ProgressState, stage: number, description: string) {
  const percent = Math.round((stage / TOTAL_STAGES) * 100);
  const message = `[${stage}/${TOTAL_STAGES}] ${percent}% - ${description}`;
  
  if (state.currentStage === 0) {
    // First time - start the spinner
    state.spinner.start(message);
  } else {
    // Update existing spinner message
    state.spinner.message(message);
  }
  
  state.currentStage = stage;
}

function completeProgress(state: ProgressState) {
  state.spinner.stop('Benchmark complete');
}

// ============================================================================
// SECTION 1: UTILITY FUNCTIONS
// ============================================================================
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

// LLM Judge display function
function displayLLMJudgeScores(result: { scores?: Record<string, any>; evaluator_results?: Array<{ name: string; details?: string }> }) {
  const llmJudgeScore = (result.scores as any)['LLMJudgeEvaluator'];
  const evaluatorResults = (result as any).evaluator_results;
  
  let llmJudgeResult = null;
  if (evaluatorResults && Array.isArray(evaluatorResults)) {
    llmJudgeResult = evaluatorResults.find((r: any) => r.name === 'LLMJudgeEvaluator');
  }
  
  if (!llmJudgeResult && !llmJudgeScore) return;
  
  const details = llmJudgeResult?.details || llmJudgeScore?.details;
  if (!details) return;
  
  try {
    const parsedDetails = JSON.parse(details);
    if (parsedDetails.scores && Array.isArray(parsedDetails.scores)) {
      console.log(`\\n${chalk.bold.underline('LLM Judge Detailed Scores')}`);
      console.log(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
      console.log(`│ ${chalk.bold('Category'.padEnd(20))} ${chalk.bold('Score'.padEnd(8))} ${chalk.bold('Weight'.padEnd(8))} ${chalk.bold('Status'.padEnd(15))} │`);
      console.log(`├${'─'.repeat(TABLE_WIDTH)}┤`);
      
      const weights: Record<string, number> = {
        'dependency_quality': 25,
        'safety_stability': 20,
        'best_practices': 15,
        'monorepo_coordination': 15,
        'technical_execution': 10,
        'communication_transparency': 10,
        'long_term_maintainability': 5
      };
      
      const expectedCategories = [
        'dependency_quality',
        'safety_stability', 
        'best_practices',
        'monorepo_coordination',
        'technical_execution',
        'communication_transparency',
        'long_term_maintainability',
        'overall_integrity'
      ];
      
      const scoreMap = new Map();
      parsedDetails.scores.forEach((score: any) => {
        if (score.category && score.score !== undefined) {
          scoreMap.set(score.category, score);
        }
      });
      
      expectedCategories.forEach(category => {
        const score = scoreMap.get(category);
        const weight = weights[category] || 0;
        
        if (score) {
          const percent = (score.score / 5) * 100;
          const color = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'green' : percent >= SCORE_THRESHOLDS.GOOD ? 'yellow' : 'red';
          const status = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'Excellent' : percent >= SCORE_THRESHOLDS.GOOD ? 'Good' : 'Needs Work';
          const statusColor = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'green' : percent >= SCORE_THRESHOLDS.GOOD ? 'yellow' : 'red';
          const categoryName = category.replace(/_/g, ' ').replace(/\\b\\w/g, (l: string) => l.toUpperCase());
          
          console.log(`│ ${chalk.cyan(categoryName.padEnd(20))} ${chalk[color]((score.score.toFixed(1)).padEnd(8))} ${chalk.gray((weight + '%').padEnd(8))} ${chalk[statusColor](status.padEnd(15))} │`);
        } else {
          const categoryName = category.replace(/_/g, ' ').replace(/\\b\\w/g, (l: string) => l.toUpperCase());
          console.log(`│ ${chalk.red(categoryName.padEnd(20))} ${chalk.red('N/A'.padEnd(8))} ${chalk.gray((weight + '%').padEnd(8))} ${chalk.red('Missing'.padEnd(15))} │`);
        }
      });
      
      console.log(`└${'─'.repeat(TABLE_WIDTH)}┘`);
      
      if (parsedDetails.overall_assessment) {
        console.log(`\\n${chalk.bold('LLM Judge Assessment:')}`);
        console.log(chalk.gray(parsedDetails.overall_assessment));
      }
      
      if (parsedDetails.input_tokens) {
        console.log(`\\n${chalk.bold('Token Usage:')}`);
        console.log(chalk.blue(`Input tokens: ${parsedDetails.input_tokens}`));
      }
    }
  } catch (error) {
    console.log(`\\n${chalk.bold('LLM Judge Details:')}`);
    console.log(chalk.gray(details));
  }
}

// Common display functions
function displayRunInfo(run: { status: string; suite: string; scenario: string; tier: string; agent: string; model?: string; weightedScore?: number | null; runId: string; startedAt: string | number }, index: number) {
  const status = run.status === 'completed' 
    ? chalk.green('✓') 
    : run.status === 'failed' 
    ? chalk.red('✗') 
    : chalk.yellow('○');
  
  console.log(`\\n${chalk.bold(`${index + 1}.`)} ${status} ${chalk.cyan(run.suite)}/${chalk.cyan(run.scenario)} ${chalk.gray(`(${run.tier})`)}`);
  console.log(`   ${formatStats('Agent', run.agent + (run.model ? ` (${run.model})` : ''))}`);
  console.log(`   ${formatStats('Score', run.weightedScore?.toFixed(4) || 'N/A', 'green')}`);
  console.log(`   ${chalk.gray(new Date(run.startedAt).toLocaleString())}`);
  console.log(`   ${chalk.dim(`ID: ${run.runId.substring(0, 8)}...`)}`);
}


function displayModelPerformance(modelStats: Array<{ model: string; avgScore: number; runs: number }>) {
  if (modelStats.length === 0) return;
  
  console.log('\\n' + chalk.underline('Model Performance'));
  modelStats.forEach((model, index) => {
    const rank = index + 1;
    const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
    const percent = model.avgScore > 1 ? model.avgScore.toFixed(1) : (model.avgScore * 100).toFixed(1);
    const color = model.avgScore >= 0.9 ? 'green' : model.avgScore >= 0.7 ? 'yellow' : 'red';
    
    console.log(`  ${rankDisplay} ${chalk.bold(model.model.padEnd(35))} ${chalk[color](percent + '%')} ${chalk.gray(`(${model.runs} runs)`)}`);
  });
  
  const bestModel = modelStats[0];
  const bestPercent = bestModel.avgScore > 1 ? bestModel.avgScore.toFixed(1) : (bestModel.avgScore * 100).toFixed(1);
  console.log(`\\n  ${chalk.cyan('Top Model:')} ${chalk.bold(bestModel.model)} ${chalk.green(bestPercent + '%')} ${chalk.gray(`(${bestModel.runs} runs)`)}`);
}

// ============================================================================
// SECTION 2: CORE DOMAIN FUNCTIONS
// ============================================================================

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

// ============================================================================
// DYNAMIC TIER LOADING
// ============================================================================

function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    'L0': 'L0 - Minimal',
    'L1': 'L1 - Basic',
    'L2': 'L2 - Directed',
    'L3': 'L3 - Migration',
    'Lx': 'Lx - Adversarial'
  };
  return labels[tier] || tier;
}

function getAvailableTiers(suite: string, scenario: string): Array<{value: string, label: string}> {
  const root = findRepoRoot();
  const promptDir = join(root, 'suites', suite, 'prompts', scenario);
  
  if (!existsSync(promptDir)) {
    return [];
  }
  
  const files = readdirSync(promptDir);
  const tierPattern = /^(L\\d+|Lx)(-.*)?\\.md$/;
  
  const tiers = new Set<string>();
  files.forEach(file => {
    const match = file.match(tierPattern);
    if (match) {
      tiers.add(match[1]);
    }
  });
  
  return Array.from(tiers).sort().map(tier => ({
    value: tier,
    label: getTierLabel(tier)
  }));
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

function createAgentAdapter(agentName: string, model?: string): AgentAdapter {
	switch (agentName) {
		case 'openrouter':
			// Pass model directly to constructor instead of using environment variable
			return new OpenRouterAdapter(process.env.OPENROUTER_API_KEY, model);
		case 'anthropic':
			if (model) {
				process.env.CLAUDE_MODEL = model;
			}
			return new AnthropicAdapter();
		case 'claude-code':
			return new ClaudeCodeAdapter(model);
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


// ============================================================================
// SECTION 3: COMMAND-LINE ARGUMENT PARSING
// ============================================================================

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


	const noJson = rest.includes('--no-json');

	return { cmd, suite, scenario, tier, agent, model, noJson } as const;
}

function showHelp() {
	console.log(chalk.cyan(createTitle()));
	intro(chalk.bgBlue(' CLI Help '));
	
	console.log('\\n' + chalk.bold('Usage:'));
	console.log(`  ${chalk.cyan('pnpm bench')} <suite> <scenario> [options]`);
	
	console.log('\\n' + chalk.bold('Commands:'));
	console.log(`  ${chalk.cyan('--history')} [limit]              Show recent runs`);
	console.log(`  ${chalk.cyan('--evaluators')}                  Show evaluator stats`);
	console.log(`  ${chalk.cyan('--stats')} suite <name>          Suite statistics`);
	console.log(`  ${chalk.cyan('--stats')} scenario <s> <sc>     Scenario statistics`);
	console.log(`  ${chalk.cyan('--stats')} run <id>              Run details`);
	console.log(`  ${chalk.cyan('--batches')} [limit]             List recent batches`);
	console.log(`  ${chalk.cyan('--batch-details')} <id>          Detailed batch analytics`);
	console.log(`  ${chalk.cyan('--compare-batches')} <id1> <id2> Compare multiple batches`);
	console.log(`  ${chalk.cyan('--clear-db')}                    Clear database`);
	
	console.log('\\n' + chalk.bold('Options:'));
	console.log(`  ${chalk.cyan('--tier')} <tier>                   Difficulty tier (varies by scenario)`);
	console.log(`  ${chalk.cyan('--agent')} <echo|anthropic|openrouter|claude-code>      Agent to use`);
	console.log(`  ${chalk.cyan('--model')} <name>                Model name`);
	console.log(`  ${chalk.cyan('--no-json')}                     Skip JSON output`);
	
	console.log('\\n' + chalk.bold('Model Selection:'));
	console.log(`  ${chalk.cyan('OpenRouter Models:')} Search-based selection from 200+ models`);
	console.log(`  ${chalk.gray('Search by:')} model name, provider, or description`);
	console.log(`  ${chalk.gray('Example searches:')} \"gpt-4o\", \"llama-3\", \"gemma free\", \"claude sonnet\"`);
	
	console.log('\\n' + chalk.bold('Web Dashboard:'));
	console.log(`  ${chalk.blue('http://localhost:3000')} ${chalk.gray('- Interactive charts and analytics')}`);
	console.log(`  ${chalk.gray('Run:')} ${chalk.yellow('pnpm dev')} ${chalk.gray('to start the web server')}`);
	
	outro(chalk.gray('Run any command to get started'));
}

// ============================================================================
// SECTION 4: INTERACTIVE MENU SYSTEM
// ============================================================================

async function showInteractiveMenu() {
	// Check environment variables for interactive mode
	await validateEnvironment();
	
	console.log(chalk.cyan(createTitle()));
	intro(chalk.bgBlue(' Interactive Mode '));
	
	// Show web dashboard info
	console.log(`\\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')} ${chalk.blue('http://localhost:3000')} ${chalk.gray('- Interactive charts and analytics')}`);
	console.log(`   ${chalk.gray('Run:')} ${chalk.yellow('pnpm dev')} ${chalk.gray('to start the web server')}\\n`);
	
	while (true) {
		const action = await select({
			message: 'What would you like to do?',
			options: [
				{ value: 'benchmark', label: 'Run Benchmarks' },
				{ value: 'history', label: 'History' },
				{ value: 'statistics', label: 'Statistics' },
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
				await runInteractiveHistoryMenu();
				break;
			case 'statistics':
				await runInteractiveStatisticsMenu();
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
		console.log('\\n');
	}
}

// ============================================================================
// SECTION 5: INTERACTIVE COMMANDS - BENCHMARKS
// ============================================================================

async function executeMultipleBenchmarks(
	suites: string[],
	scenarios: string[],
	tiers: string[],
	agents: string[],
	models: (string | undefined)[],
	noJson: boolean
) {
	// Initialize batch tracking
	const logger = BenchmarkLogger.getInstance();
	const batchId = logger.startBatch();
	
	// Calculate total combinations
	const combinations: Array<{
		suite: string;
		scenario: string;
		tier: string;
		agent: string;
		model?: string;
	}> = [];
	
	for (const suite of suites) {
		for (const scenario of scenarios) {
			const availableTiers = getAvailableTiers(suite, scenario);
			const availableTierValues = availableTiers.map(t => t.value);
			const validTiers = tiers.filter(tier => availableTierValues.includes(tier));
			
			if (validTiers.length === 0) {
				console.log(chalk.yellow(`⚠ Skipping ${suite}/${scenario}: no valid tiers (available: ${availableTierValues.join(', ')})`));
				continue;
			}
			
			// Log if some tiers are being skipped
			const skippedTiers = tiers.filter(tier => !availableTierValues.includes(tier));
			if (skippedTiers.length > 0) {
				console.log(chalk.gray(`  Skipping tiers for ${suite}/${scenario}: ${skippedTiers.join(', ')}`));
			}
			
			for (const tier of validTiers) {
				for (const agent of agents) {
					// Handle model selection per agent
					const agentModels = (agent === 'anthropic' || agent === 'claude-code' || agent === 'openrouter') 
						? models.filter(m => m !== undefined)
						: [undefined];
					
					for (const model of agentModels) {
						combinations.push({ suite, scenario, tier, agent, model });
					}
				}
			}
		}
	}
	
	// Automatically determine parallel execution based on number of benchmarks
	const useParallel = combinations.length >= 3; // Enable parallel for 3+ benchmarks
	let concurrency = 3;
	
	if (useParallel) {
		// Smart concurrency based on number of benchmarks
		if (combinations.length <= 5) {
			concurrency = 2; // Conservative for small batches
		} else if (combinations.length <= 15) {
			concurrency = 3; // Balanced for medium batches
		} else if (combinations.length <= 30) {
			concurrency = 5; // Aggressive for large batches
		} else {
			concurrency = 8; // Maximum for very large batches
		}
	}
	
	// Show summary
	console.log(chalk.bold.underline(`\\nRunning ${combinations.length} benchmark(s):`));
	if (useParallel) {
		console.log(chalk.gray(`Parallel execution with concurrency: ${concurrency}`));
	}
	
	// Track batch statistics
	let successfulRuns = 0;
	let totalScore = 0;
	let totalWeightedScore = 0;
	const startTime = Date.now();
	
	if (useParallel) {
		// Parallel execution
		await executeWithConcurrency(
			combinations,
			concurrency,
			async (combo, i) => {
				const { suite, scenario, tier, agent, model } = combo;
				console.log(`${chalk.bold.cyan(`[${i + 1}/${combinations.length}]`)} ${suite}/${scenario} ${chalk.gray(`(${tier}) ${agent}${model ? ` [${model}]` : ''}`)}`);
				await executeBenchmark(suite, scenario, tier, agent, model, noJson, batchId, true); // quiet mode
			}
		);
	} else {
		// Sequential execution
		for (let i = 0; i < combinations.length; i++) {
			const { suite, scenario, tier, agent, model } = combinations[i];
			
			console.log(`${chalk.bold.cyan(`[${i + 1}/${combinations.length}]`)} ${suite}/${scenario} ${chalk.gray(`(${tier}) ${agent}${model ? ` [${model}]` : ''}`)}`);
			
			await executeBenchmark(suite, scenario, tier, agent, model, noJson, batchId, true); // quiet mode
		}
	}
	
	// Complete batch tracking
	const endTime = Date.now();
	const duration = endTime - startTime;
	
	// Calculate batch statistics
	const batchStats = logger.getBatchDetails(batchId);
	if (batchStats) {
		successfulRuns = batchStats.successfulRuns;
		totalScore = batchStats.avgScore * batchStats.totalRuns;
		totalWeightedScore = batchStats.avgWeightedScore * batchStats.totalRuns;
	}
	
	logger.completeBatch(batchId, {
		totalRuns: combinations.length,
		successfulRuns,
		avgScore: combinations.length > 0 ? totalScore / combinations.length : 0,
		avgWeightedScore: combinations.length > 0 ? totalWeightedScore / combinations.length : 0,
		metadata: {
			suites,
			scenarios,
			tiers,
			agents,
			models: models.filter(m => m !== undefined),
			duration
		}
	});
	
	// Note: Database is now created directly in public/ directory
	
	// Get comprehensive batch analytics
	const analytics = logger.getBatchAnalytics(batchId);
	
	// Show batch summary header
	console.log('\\n' + chalk.bold.underline('Batch Summary'));
	console.log(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
	console.log(`│ ${chalk.bold('Batch ID:')} ${chalk.dim(batchId.substring(0, 8))}...`);
	
	// Show model if all runs used the same model
	const uniqueModels = [...new Set(combinations.map(c => c.model).filter(m => m))];
	if (uniqueModels.length === 1) {
		console.log(`│ ${chalk.bold('Model:')} ${chalk.cyan(uniqueModels[0])}`);
	}
	
	console.log(`│ ${chalk.bold('Total Runs:')} ${combinations.length}`);
	console.log(`│ ${chalk.bold('Completed:')} ${successfulRuns} (${combinations.length > 0 ? ((successfulRuns / combinations.length) * 100).toFixed(1) : 0}%)`);
	
	// Show failed runs breakdown
	const failedRuns = combinations.length - successfulRuns;
	if (failedRuns > 0) {
		console.log(`│ ${chalk.bold('Failed:')} ${chalk.red(failedRuns)} (${combinations.length > 0 ? ((failedRuns / combinations.length) * 100).toFixed(1) : 0}%)`);
		
		// Get failure breakdown
		const failureBreakdown = logger.getFailureBreakdown(batchId);
		if (failureBreakdown.length > 0) {
			const failureReasons = failureBreakdown.map(f => `${f.errorType}: ${f.count}`).join(', ');
			console.log(`│ ${chalk.bold('Failure Reasons:')} ${chalk.red(failureReasons)}`);
		}
	}
	
	console.log(`│ ${chalk.bold('Avg Score:')} ${combinations.length > 0 ? (totalWeightedScore / combinations.length).toFixed(4) : 0} / 10.0`);
	console.log(`│ ${chalk.bold('Duration:')} ${(duration / 1000).toFixed(2)}s`);
	console.log(`└${'─'.repeat(TABLE_WIDTH)}┘`);
	
	// Show suite breakdown if analytics available
	if (analytics && analytics.suiteBreakdown.length > 0) {
		console.log(`\\n${chalk.bold.underline('Suite Breakdown')}`);
		analytics.suiteBreakdown.forEach(suite => {
			const successRate = suite.runs > 0 ? ((suite.successfulRuns / suite.runs) * 100).toFixed(0) : 0;
			console.log(`  ${chalk.cyan(suite.suite)}/${suite.scenario}: ${suite.avgWeightedScore.toFixed(2)}/10 ${chalk.gray(`(${successRate}% success, ${suite.runs} runs)`)}`);
		});
	}
	
	// Show agent performance
	if (analytics && analytics.agentPerformance.length > 0) {
		console.log(`\\n${chalk.bold.underline('Agent Performance')}`);
		analytics.agentPerformance.forEach((agent, index) => {
			const rank = index + 1;
			const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
			const modelStr = agent.model && agent.model !== 'default' ? ` [${agent.model}]` : '';
			const scoreColor = agent.avgWeightedScore >= 9 ? 'green' : agent.avgWeightedScore >= 7 ? 'yellow' : 'red';
			console.log(`  ${rankDisplay} ${chalk.cyan(agent.agent)}${modelStr}: ${chalk[scoreColor](agent.avgWeightedScore.toFixed(2))}/10 ${chalk.gray(`(${agent.successfulRuns}/${agent.runs} runs)`)}`);
		});
	}
	
	// Show failed runs if any
	if (analytics && analytics.failedRuns.length > 0) {
		console.log(`\\n${chalk.bold.underline(chalk.red('Failed Runs'))}`);
		analytics.failedRuns.forEach(run => {
			console.log(`  ${chalk.red('✗')} ${run.suite}/${run.scenario} (${run.tier}) ${run.agent} - ${run.error || 'Unknown error'}`);
		});
	}
	
	// Show completion summary
	console.log('\\n' + chalk.green('✓') + chalk.bold(` Completed all ${combinations.length} benchmark(s)!`));
	
	// Note: Database is now created directly in public/ directory
}

// ============================================================================
// PARALLEL EXECUTION HELPER
// ============================================================================

async function executeWithConcurrency<T>(
  items: T[],
  concurrency: number,
  executor: (item: T, index: number) => Promise<void>
): Promise<void> {
  const results: Promise<void>[] = [];
  let currentIndex = 0;
  
  async function runNext(): Promise<void> {
    const index = currentIndex++;
    if (index >= items.length) return;
    
    await executor(items[index], index);
    await runNext();
  }
  
  // Start initial batch of concurrent executions
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    results.push(runNext());
  }
  
  await Promise.all(results);
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
	
	// Select suites (multiselect)
	const selectedSuites = await multiselect({
		message: 'Choose suites:',
		options: [
			{ value: '__ALL__', label: 'All suites' },
			...suites.map(suite => ({ value: suite, label: suite }))
		],
		required: true
	});

	if (isCancel(selectedSuites)) {
		cancel('Operation cancelled.');
		return;
	}

	// Expand \"All\" selection
	const suitesToUse = selectedSuites.includes('__ALL__') ? suites : selectedSuites;
	
	// Get scenarios for all selected suites
	const allScenarios: Array<{ value: string; label: string; suite: string }> = [];
	for (const suite of suitesToUse) {
		const scenariosDir = join(suitesDir, suite, 'scenarios');
		if (existsSync(scenariosDir)) {
			const scenarios = readdirSync(scenariosDir).filter(dir => 
				existsSync(join(scenariosDir, dir, 'scenario.yaml'))
			);
			scenarios.forEach(scenario => {
				allScenarios.push({ 
					value: scenario, 
					label: `${scenario} (${suite})`,
					suite 
				});
			});
		}
	}
	
	if (allScenarios.length === 0) {
		log.error(chalk.red('No scenarios found for selected suites'));
		return;
	}
	
	// Select scenarios (multiselect)
	const selectedScenarios = await multiselect({
		message: 'Choose scenarios:',
		options: [
			{ value: '__ALL__', label: 'All scenarios' },
			...allScenarios
		],
		required: true
	});

	if (isCancel(selectedScenarios)) {
		cancel('Operation cancelled.');
		return;
	}

	// Expand \"All\" selection and filter by suite
	const scenariosToUse = selectedScenarios.includes('__ALL__') 
		? allScenarios.map(s => s.value)
		: selectedScenarios;
	
	// Collect available tiers from all selected scenarios
	console.log('🔍 Scanning available tiers for selected scenarios...');
	const availableTiersSet = new Set<string>();
	const scenarioTierMap = new Map<string, string[]>();

	for (const suite of suitesToUse) {
		for (const scenario of scenariosToUse) {
			const tiers = getAvailableTiers(suite, scenario);
			const tierValues = tiers.map(t => t.value);
			scenarioTierMap.set(`${suite}/${scenario}`, tierValues);
			tiers.forEach(tier => availableTiersSet.add(tier.value));
		}
	}

	// Show what tiers are available for each scenario
	scenarioTierMap.forEach((tiers, scenario) => {
		console.log(`  ${scenario}: ${tiers.join(', ')}`);
	});

	const tierOptions = [
		{ value: '__ALL__', label: 'All available tiers' },
		...Array.from(availableTiersSet).sort().map(tier => ({
			value: tier,
			label: getTierLabel(tier)
		}))
	];

	console.log(`✅ Found ${availableTiersSet.size} unique tiers across all scenarios`);
	
	// Select tiers (multiselect)
	const selectedTiers = await multiselect({
		message: 'Choose difficulty tiers:',
		options: tierOptions,
		required: true
	});

	if (isCancel(selectedTiers)) {
		cancel('Operation cancelled.');
		return;
	}

	// Expand \"All\" selection
	const tiersToUse = selectedTiers.includes('__ALL__') 
		? Array.from(availableTiersSet).sort()
		: selectedTiers;
	
	// Select agents (multiselect) - dynamically loaded
	console.log('Loading available agents...');
	const agentOptions = await getAvailableAgents();
	console.log(`✅ Loaded ${agentOptions.length} agent options`);
	
	const selectedAgents = await multiselect({
		message: 'Choose agents:',
		options: agentOptions,
		required: true
	});

	if (isCancel(selectedAgents)) {
		cancel('Operation cancelled.');
		return;
	}

	// Expand \"All\" selection
	const agentsToUse = selectedAgents.includes('__ALL__') 
		? ['echo', 'openrouter', 'anthropic', 'claude-code'] 
		: selectedAgents;
	
	console.log(`🎯 Selected agents: ${agentsToUse.join(', ')}`);
	
	// Ask for models if needed
	let modelsToUse: (string | undefined)[] = [undefined];
	const needsOpenRouterModels = agentsToUse.some(agent => agent === 'openrouter');
	const needsAnthropicModels = agentsToUse.some(agent => agent === 'anthropic');
	const needsClaudeCodeModels = agentsToUse.some(agent => agent === 'claude-code');
	
	if (needsOpenRouterModels) {
		console.log('🔍 Loading OpenRouter models with tool support...');
		
		const openrouterAPI = new OpenRouterAPI(process.env.OPENROUTER_API_KEY || '');
		const toolModels = await openrouterAPI.getModelsWithToolSupport();
		
		console.log(`✅ Found ${toolModels.length} models with tool support`);
		
		// Quick shortcuts for common models
		const QUICK_MODELS = {
			'free': 'Filter by free models only',
			'gpt': 'OpenAI GPT models',
			'claude': 'Anthropic Claude models',
			'llama': 'Meta Llama models',
			'gemma': 'Google Gemma models',
			'mistral': 'Mistral AI models'
		};

		// Show shortcuts
		console.log(`\\n${chalk.gray('Quick searches:')} ${Object.keys(QUICK_MODELS).join(', ')}`);
		
		// Text-based search instead of dropdown
		const modelSearch = await text({
			message: 'Search for OpenRouter model (type to filter):',
			placeholder: 'e.g., gpt-4o, llama, gemma, claude',
			validate: (value) => {
				if (!value || value.length < 2) {
					return 'Please enter at least 2 characters to search';
				}
			}
		});

		if (isCancel(modelSearch)) {
			cancel('Operation cancelled.');
			return;
		}

		// Search and display results
		const searchResults = openrouterAPI.searchModels(toolModels, modelSearch);
		
		if (searchResults.length === 0) {
			log.warning(`No models found matching \"${modelSearch}\"`);
			log.info('Try searching for: gpt-4o, llama, gemma, claude, mistral');
			return;
		}

		// Show search results with pricing info
		console.log(`\\n📋 Found ${searchResults.length} matching models:\\n`);
		
		const selectedModel = await select({
			message: 'Choose a model:',
			options: searchResults.map(model => {
				const promptCost = parseFloat(model.pricing.prompt);
				const isFree = promptCost === 0;
				const costLabel = isFree ? '(FREE)' : `($${promptCost}/1K tokens)`;
				
				return {
					value: model.id,
					label: `${model.name} ${costLabel}`,
					hint: model.description?.substring(0, 80)
				};
			})
		});

		if (isCancel(selectedModel)) {
			cancel('Operation cancelled.');
			return;
		}

		modelsToUse = [selectedModel];
		console.log(`🎯 Selected model: ${selectedModel}`);
		
		// Display selected model details
		const selectedModelInfo = toolModels.find(m => m.id === selectedModel);
		
		if (selectedModelInfo) {
			console.log(`\\n${chalk.bold.cyan('Model Details:')}`);
			console.log(`  ${chalk.gray('Name:')} ${selectedModelInfo.name}`);
			console.log(`  ${chalk.gray('ID:')} ${selectedModelInfo.id}`);
			console.log(`  ${chalk.gray('Context:')} ${selectedModelInfo.context_length.toLocaleString()} tokens`);
			console.log(`  ${chalk.gray('Cost:')} $${selectedModelInfo.pricing.prompt}/1K prompt, $${selectedModelInfo.pricing.completion}/1K completion`);
			
			const isFree = parseFloat(selectedModelInfo.pricing.prompt) === 0;
			if (isFree) {
				console.log(`  ${chalk.green('✓ FREE MODEL')}`);
			}
		}
	} else if (needsAnthropicModels) {
		console.log('🧠 Loading available Anthropic models...');
		// Anthropic has a fixed set of models
		const anthropicModels = [
			{ value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Current)' },
			{ value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Current)' },
			{ value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Active)' },
			{ value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Active)' },
			{ value: 'claude-opus-4-20250514', label: 'Claude Opus 4 (Active)' },
			{ value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1 (Active)' },
			{ value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (Active)' },
			{ value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Active)' }
		];
		
		const selectedModels = await multiselect({
			message: 'Choose Anthropic models:',
			options: anthropicModels,
			required: true
		});

		if (isCancel(selectedModels)) {
			cancel('Operation cancelled.');
			return;
		}

		modelsToUse = selectedModels;
		console.log(`🎯 Selected Anthropic models: ${modelsToUse.join(', ')}`);
	} else if (needsClaudeCodeModels) {
		console.log('🧠 Loading available Claude Code models...');
		// Claude Code has a fixed set of models
		const claudeCodeModels = [
			{ value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Current)' },
			{ value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Current)' },
			{ value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Active)' },
			{ value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Active)' },
			{ value: 'claude-opus-4-20250514', label: 'Claude Opus 4 (Active)' },
			{ value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1 (Active)' },
			{ value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (Active)' },
			{ value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Active)' }
		];
		
		const selectedModels = await multiselect({
			message: 'Choose Claude Code models:',
			options: claudeCodeModels,
			required: true
		});

		if (isCancel(selectedModels)) {
			cancel('Operation cancelled.');
			return;
		}

		modelsToUse = selectedModels;
		console.log(`🎯 Selected Claude Code models: ${modelsToUse.join(', ')}`);
	}
	
	
	// Ask for JSON output
	const includeJson = await confirm({
		message: 'Include JSON output?',
		initialValue: true
	});
	
	// Calculate total combinations for automatic parallel decision
	const totalCombinations = suitesToUse.length * scenariosToUse.length * tiersToUse.length * agentsToUse.length * modelsToUse.length;
	
	// Automatically determine parallel execution based on number of benchmarks
	const useParallel = totalCombinations >= 3; // Enable parallel for 3+ benchmarks
	let concurrency = 3;
	
	if (useParallel) {
		// Smart concurrency based on number of benchmarks
		if (totalCombinations <= 5) {
			concurrency = 2; // Conservative for small batches
		} else if (totalCombinations <= 15) {
			concurrency = 3; // Balanced for medium batches
		} else if (totalCombinations <= 30) {
			concurrency = 5; // Aggressive for large batches
		} else {
			concurrency = 8; // Maximum for very large batches
		}
	}
	
	// Show summary of what will be executed
	console.log(`\\n${chalk.green('►')} Will run ${chalk.bold(totalCombinations.toString())} benchmark combination(s)`);
	console.log(`   ${chalk.cyan('Suites:')} ${suitesToUse.join(', ')}`);
	console.log(`   ${chalk.cyan('Scenarios:')} ${scenariosToUse.join(', ')}`);
	console.log(`   ${chalk.cyan('Tiers:')} ${tiersToUse.join(', ')}`);
	console.log(`   ${chalk.cyan('Agents:')} ${agentsToUse.join(', ')}`);
	if (needsOpenRouterModels || needsAnthropicModels || needsClaudeCodeModels) {
		console.log(`   ${chalk.cyan('Models:')} ${modelsToUse.join(', ')}`);
	}
	console.log(`   ${chalk.cyan('JSON output:')} ${includeJson ? 'Yes' : 'No'}`);
	console.log(`   ${chalk.cyan('Parallel execution:')} ${useParallel ? `Yes (concurrency: ${concurrency})` : 'No'}`);
	
	// Show title before execution
	console.log(chalk.cyan(createTitle()));
	
	// Execute all benchmark combinations
	await executeMultipleBenchmarks(
		suitesToUse,
		scenariosToUse,
		tiersToUse,
		agentsToUse,
		modelsToUse,
		!includeJson
	);
}

// ============================================================================
// SECTION 6: INTERACTIVE COMMANDS - HISTORY & STATS
// ============================================================================

async function runInteractiveHistory() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		console.log(chalk.gray(`\\nView in browser: ${serverUrl}`));
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

async function runInteractiveSuiteStats() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		console.log(`\\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')}`);
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
			console.log('\\n' + chalk.underline('Overview'));
			console.log(formatStats('Total Runs', stats.totalRuns));
			console.log(formatStats('Success Rate', `${stats.totalRuns > 0 ? ((stats.successfulRuns / stats.totalRuns) * 100).toFixed(1) : 0}%`, 'green'));
			console.log(formatStats('Avg Score', stats.avgScore.toFixed(4), 'yellow'));
			console.log(formatStats('Avg Weighted', stats.avgWeightedScore.toFixed(4), 'yellow'));
			console.log(formatStats('Avg Duration', `${(stats.avgDuration / 1000).toFixed(2)}s`, 'blue'));
			
			if (stats.scenarioBreakdown.length > 0) {
				console.log('\\n' + chalk.underline('Scenario Breakdown'));
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

async function runInteractiveScenarioStats() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		console.log(`\\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')}`);
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
			console.log(`\\n${bar} ${chalk.bold(stats.avgWeightedScore.toFixed(2))}/10`);
			
			console.log('\\n' + chalk.underline('Overview'));
			console.log(formatStats('Total Runs', stats.totalRuns));
			console.log(formatStats('Success Rate', `${stats.totalRuns > 0 ? ((stats.successfulRuns / stats.totalRuns) * 100).toFixed(1) : 0}%`, 'green'));
			console.log(formatStats('Avg Score', stats.avgScore.toFixed(4), 'yellow'));
			console.log(formatStats('Score Range', `${stats.minScore.toFixed(4)} - ${stats.maxScore.toFixed(4)}`, 'blue'));
			
			// Agent comparison table
			if (stats.agentComparison.length > 0) {
				console.log('\\n' + chalk.underline('Agent Performance'));
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

async function runInteractiveRunStats() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		console.log(`\\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')}`);
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
			console.log(`\\n${chalk.gray('ID:')} ${chalk.dim(selectedRun.substring(0, 8))}...`);
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
				console.log('\\n' + chalk.underline('Evaluations'));
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
				console.log('\\n' + chalk.underline('Telemetry'));
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

async function runInteractiveBatchStats() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		console.log(chalk.gray(`\\nView in browser: ${serverUrl}`));
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
			console.log(`\\n${chalk.gray('ID:')} ${chalk.dim(selectedBatch.substring(0, 8))}...`);
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
				console.log('\\n' + chalk.underline('Runs in Batch'));
				const sortedRuns = batchStats.runs
					.filter(run => run.weightedScore !== null && run.weightedScore !== undefined)
					.sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0));
				
				sortedRuns.forEach((run, index) => {
					const rank = index + 1;
					const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
					const status = run.status === 'completed' ? chalk.green('✓') : run.status === 'failed' ? chalk.red('✗') : chalk.yellow('○');
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


async function runInteractiveEvaluators() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		console.log(chalk.gray(`\\nView in browser: ${serverUrl}`));
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
		
		console.log('\\n' + chalk.underline('Performance Ranking'));
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
		
		console.log('\\n' + chalk.underline('Performance Summary'));
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

async function runInteractiveBatchHistory() {
	// Start dev server for web viewing
	try {
		const serverUrl = await startDevServer();
		// Note: Database is now created directly in public/ directory
		console.log(`\\n${chalk.cyan('🌐')} ${chalk.bold('Web Dashboard:')}`);
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
			
			console.log(`\\n${chalk.bold(`${index + 1}.`)} ${status} ${chalk.cyan('Batch')} ${chalk.dim(batch.batchId.substring(0, 8))}...`);
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

// ============================================================================
// SECTION 7: INTERACTIVE COMMANDS - UTILITIES
// ============================================================================

async function runInteractiveClear() {
	const logger = BenchmarkLogger.getInstance();
	
	try {
		intro(chalk.bgRed(' Clear Database '));
		
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

// ============================================================================
// SECTION 8: MAIN BENCHMARK RUNNER
// ============================================================================

async function executeBenchmark(suite: string, scenario: string, tier: string, agent: string, model?: string, noJson?: boolean, batchId?: string, quiet?: boolean) {
	// Initialize logger
	const logger = BenchmarkLogger.getInstance();
	const runId = logger.startRun(suite, scenario, tier, agent, model, batchId);
	const startTime = Date.now();
	
	// Initialize progress tracker (only if not in quiet mode)
	const progress = quiet ? null : createProgress();
	
	try {
		// Stage 1: Setup
		if (progress) updateProgress(progress, 1, 'Loading scenario configuration');
		const scenarioCfg = loadScenario(suite, scenario);
		
		if (progress) updateProgress(progress, 1, 'Loading prompt');
		const promptContent = loadPrompt(suite, scenario, tier);
		
		// Early failure check: prompt missing for non-echo agents
		if (!promptContent && agent !== 'echo') {
			logger.failRun('Prompt file not found', 'prompt');
			if (!quiet) console.log(chalk.red('✗ Prompt file not found'));
			if (quiet) console.log(chalk.red(`[X] ${suite}/${scenario} (${tier}) ${agent}${model ? ` [${model}]` : ''} - FAILED: Prompt file not found`));
			return;
		}
		
		// Stage 2: Workspace
		if (progress) updateProgress(progress, 2, 'Preparing workspace');
		const workspacePrep = prepareWorkspaceFromFixture(suite, scenario);
		
		// Early failure check: workspace preparation failed
		if (!workspacePrep) {
			logger.failRun('Workspace preparation failed', 'workspace');
			if (!quiet) console.log(chalk.red('✗ Workspace preparation failed'));
			if (quiet) console.log(chalk.red(`[X] ${suite}/${scenario} (${tier}) ${agent}${model ? ` [${model}]` : ''} - FAILED: Workspace preparation failed`));
			return;
		}
		
		const workspaceDir = workspacePrep.workspaceDir;
		const fixtureDir = workspacePrep.fixtureDir;
	
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


	// Stage 3: Agent Execution
	if (promptContent && agent !== 'echo') {
		if (progress) updateProgress(progress, 3, 'Agent working...');
		try {
			// Create agent adapter
		const agentAdapter = createAgentAdapter(agent, model);
			
			// Show selected model info - ALWAYS for OpenRouter
			if (agent === 'openrouter' && 'getModel' in agentAdapter) {
				const adapterModel = (agentAdapter as any).getModel();
				const modelSource = 'getModelSource' in agentAdapter 
					? (agentAdapter as any).getModelSource() 
					: 'unknown';
				
				if (modelSource === 'default') {
					console.log(chalk.yellow(`  ⚠️  Using default model: ${chalk.cyan(adapterModel)}`));
					console.log(chalk.gray(`     Tip: Search and select a model in interactive mode or use --model flag`));
				} else if (modelSource === 'environment') {
					console.log(chalk.blue(`  ℹ️  Using model from environment: ${chalk.cyan(adapterModel)}`));
				} else if (model && modelSource === 'parameter') {
					console.log(chalk.gray(`  📋 Using model: ${chalk.cyan(model)}`));
					
					// Verify match
					if (adapterModel !== model) {
						console.log(chalk.yellow(`  ⚠️  Warning: Model mismatch - requested: ${model}, adapter: ${adapterModel}`));
					} else {
						console.log(chalk.green(`  ✅ Model confirmed: ${adapterModel}`));
					}
				} else {
					console.log(chalk.gray(`  📋 Using model: ${chalk.cyan(adapterModel)}`));
				}
			} else if (model && agent !== 'openrouter') {
				// For non-OpenRouter agents, show model if provided
				console.log(chalk.gray(`  📋 Using model: ${chalk.cyan(model)}`));
			}
			
			// Agent info is shown in progress bar
			
			// Load oracle if available
			let oracle: Oracle | undefined;
			const oracleFile = scenarioCfg.oracle?.answers_file;
			if (oracleFile) {
				const scenarioDir = getScenarioDir(suite, scenario);
				const oraclePath = join(scenarioDir, oracleFile);
				if (existsSync(oraclePath)) {
					oracle = new Oracle(oraclePath);
					if (progress) updateProgress(progress, 3, 'Agent with oracle support enabled');
				}
			}
			
			// Build system prompt with tool usage guidance
			const systemPrompt = agent === 'anthropic' 
				? `You are working on a ${scenarioCfg.title}. The task is: ${scenarioCfg.description || 'Complete the development task.'}\n\nIMPORTANT: You are working in the directory: ${workspaceDir}\nThis is a prepared workspace with the files you need to modify.\n\nAvailable Tools:\n- readFile: Read any file in the workspace\n- writeFile: Modify files (e.g., package.json files)\n- runCommand: Execute shell commands (e.g., pnpm install, pnpm outdated)\n- listFiles: Explore directory structure\n- askUser: Ask questions when you need clarification or approval for major changes\n\nWork efficiently: read files to understand the current state, make necessary changes, run commands to validate, and ask questions only when truly needed for important decisions.`
				: `You are working on a ${scenarioCfg.title}. The task is: ${scenarioCfg.description || 'Complete the development task.'}\\n\\nIMPORTANT: You are working in the directory: ${workspaceDir}\\nThis is a prepared workspace with the files you need to modify.`;
			
			// Build the request
			const request: AgentRequest = {
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
				...(workspaceDir && { workspaceDir }),
			};

			// Add tools if agent supports them (Anthropic and OpenRouter)
			if ((agent === 'anthropic' || agent === 'openrouter') && workspaceDir) {
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
				
				// Convert tools to adapter-specific format
				if (agent === 'openrouter') {
					// Convert ToolDefinition to OpenRouter format
					(request as any).tools = tools.map(tool => ({
						type: 'function',
						function: {
							name: tool.name,
							description: tool.description,
							parameters: tool.input_schema  // Map input_schema → parameters
						}
					}));
				} else {
					// Anthropic uses ToolDefinition format directly
					request.tools = tools;
				}
				
				request.toolHandlers = toolHandlers;
			}

			// Execute agent request
			const response = await agentAdapter.send(request);
			
			// Show summary after agent completes
			console.log(chalk.gray(`  ✓ Tokens: ${response.tokensIn || 0} in, ${response.tokensOut || 0} out | Cost: $${(response.costUsd || 0).toFixed(4)}`));
			
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
			logger.failRun(error instanceof Error ? error.message : String(error), 'agent');
			if (!quiet) console.log(chalk.red('✗ Agent execution failed'));
			if (quiet) console.log(chalk.red(`[X] ${suite}/${scenario} (${tier}) ${agent}${model ? ` [${model}]` : ''} - FAILED: ${error instanceof Error ? error.message : String(error)}`));
			return; // Early exit - don't continue to evaluation
		}
	} else if (!promptContent) {
		// No prompt loaded, skipping agent execution
	} else {
		// Using echo agent (no actual execution)
	}

	// Stage 4: Validation
	if (progress) updateProgress(progress, 4, 'Running validation commands');
	const commandLog = workspaceDir ? runValidationCommands(workspaceDir, scenarioCfg.validation?.commands) : [];
	const diffArtifacts = workspaceDir && fixtureDir ? buildDiffArtifacts(fixtureDir, workspaceDir) : { diffSummary: [], depsDelta: [] };

	const passedCommands = commandLog.filter(cmd => cmd.exitCode === 0).length;
	if (!quiet) console.log(chalk.gray(`  ✓ ${passedCommands}/${commandLog.length} commands passed`));

	// Stage 5: Evaluation
	if (progress) updateProgress(progress, 5, 'Computing scores');
	
	try {
		if (workspaceDir) {
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
			
			// Show evaluator summary
			const avgScore = Object.values(scoreCard).reduce((sum, score) => sum + (score as number), 0) / Object.keys(scoreCard).length;
			if (!quiet) console.log(chalk.gray(`  ✓ Average score: ${(avgScore * 100).toFixed(1)}%`));
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

	// Stage 6: Results
	if (progress) updateProgress(progress, 6, 'Preparing results');
	
	if (progress) completeProgress(progress);

	// Display results in table format (only if not in quiet mode)
	const duration = (Date.now() - startTime) / 1000;
	const weightedScore = result.totals?.weighted || 0;
	
	// In quiet mode, show compact one-line output
	if (quiet) {
		const status = totalScore >= 0.9 ? chalk.green('✓') : totalScore >= 0.7 ? chalk.yellow('~') : chalk.red('✗');
		const modelStr = model ? ` [${model}]` : '';
		console.log(`${status} ${suite}/${scenario} (${tier}) ${agent}${modelStr} - ${weightedScore.toFixed(2)}/10`);
		return;
	}
	
	console.log(`\\n${chalk.bold.underline('Benchmark Results')}`);
	console.log(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
	console.log(`│ ${chalk.bold('Agent:')} ${chalk.cyan(agent.padEnd(15))} ${chalk.bold('Tier:')} ${chalk.cyan(tier.padEnd(8))} ${chalk.bold('Duration:')} ${chalk.blue(duration.toFixed(2) + 's')} │`);
	console.log(`├${'─'.repeat(TABLE_WIDTH)}┤`);
	console.log(`│ ${chalk.bold('Score (mean ± σ):')} ${chalk.green(weightedScore.toFixed(4))} ± ${chalk.green('0.0000')} ${chalk.gray('(out of 10.0)')} │`);
	console.log(`│ ${chalk.bold('Range (min ... max):')} ${chalk.green(weightedScore.toFixed(4))} ${chalk.white('...')} ${chalk.red(weightedScore.toFixed(4))} ${chalk.gray('(1 run)')} │`);
	console.log(`└${'─'.repeat(TABLE_WIDTH)}┘`);
	
	// Print evaluation breakdown in table format
	if (result.scores) {
		console.log(`\\n${chalk.bold.underline('Evaluation Breakdown')}`);
		console.log(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
		console.log(`│ ${chalk.bold('Evaluator'.padEnd(25))} ${chalk.bold('Score'.padEnd(10))} ${chalk.bold('Status'.padEnd(15))} │`);
		console.log(`├${'─'.repeat(TABLE_WIDTH)}┤`);
		
		Object.entries(result.scores).forEach(([name, score]) => {
			const percent = (score as number) * 100;
		const color = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'green' : percent >= SCORE_THRESHOLDS.GOOD ? 'yellow' : 'red';
		const status = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'Excellent' : percent >= SCORE_THRESHOLDS.GOOD ? 'Good' : 'Needs Work';
		const statusColor = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'green' : percent >= SCORE_THRESHOLDS.GOOD ? 'yellow' : 'red';
			
			// Special handling for LLM Judge Evaluator
			const displayName = name === 'LLMJudgeEvaluator' ? 'LLM Judge' : name;
			
			console.log(`│ ${chalk.cyan(displayName.padEnd(25))} ${chalk[color](score.toFixed(4).padEnd(10))} ${chalk[statusColor](status.padEnd(15))} │`);
		});
		
		console.log(`└${'─'.repeat(TABLE_WIDTH)}┘`);
		
		// Show detailed LLM Judge scores if available
		displayLLMJudgeScores(result);
	}

	// Print telemetry in table format
	if (result.telemetry) {
		console.log(`\\n${chalk.bold.underline('Telemetry')}`);
		console.log(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
		console.log(`│ ${chalk.bold('Metric'.padEnd(20))} ${chalk.bold('Value'.padEnd(20))} ${chalk.bold('Unit'.padEnd(15))} │`);
		console.log(`├${'─'.repeat(TABLE_WIDTH)}┤`);
		console.log(`│ ${chalk.cyan('Tool Calls'.padEnd(20))} ${chalk.green((result.telemetry.toolCalls || 0).toString().padEnd(20))} ${chalk.gray('calls'.padEnd(15))} │`);
		console.log(`│ ${chalk.cyan('Tokens In'.padEnd(20))} ${chalk.green((result.telemetry.tokens?.in || 0).toString().padEnd(20))} ${chalk.gray('tokens'.padEnd(15))} │`);
		console.log(`│ ${chalk.cyan('Tokens Out'.padEnd(20))} ${chalk.green((result.telemetry.tokens?.out || 0).toString().padEnd(20))} ${chalk.gray('tokens'.padEnd(15))} │`);
		console.log(`│ ${chalk.cyan('Cost'.padEnd(20))} ${chalk.green(`$${(result.telemetry.cost_usd || 0).toFixed(6)}`.padEnd(20))} ${chalk.gray('USD'.padEnd(15))} │`);
		console.log(`└${'─'.repeat(TABLE_WIDTH)}┘`);
	}

	// Show database summary in table format
	try {
		const stats = logger.getStats();
		console.log(`\\n${chalk.bold.underline('Database Summary')}`);
		console.log(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
		console.log(`│ ${chalk.bold('Metric'.padEnd(25))} ${chalk.bold('Value'.padEnd(20))} ${chalk.bold('Status'.padEnd(10))} │`);
		console.log(`├${'─'.repeat(TABLE_WIDTH)}┤`);
		console.log(`│ ${chalk.cyan('Total Runs'.padEnd(25))} ${chalk.blue(stats.totalRuns.toString().padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log(`│ ${chalk.cyan('Success Rate'.padEnd(25))} ${chalk.green(`${(stats.successRate * 100).toFixed(1)}%`.padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log(`│ ${chalk.cyan('Average Score'.padEnd(25))} ${chalk.green(stats.averageWeightedScore.toFixed(4).padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log(`│ ${chalk.cyan('Database'.padEnd(25))} ${chalk.blue('benchmark-report/public/benchmarks.db'.padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log(`└${'─'.repeat(TABLE_WIDTH)}┘`);

	} catch (dbError) {
		log.warning(chalk.yellow('Database query failed:'));
		console.error(chalk.dim(dbError instanceof Error ? dbError.message : String(dbError)));
	}

	// Optionally write JSON
	if (!noJson) {
	writeResult(result, suite, scenario);
		console.log(`\\n${chalk.green('✓')} Results saved to database and JSON`);
	} else {
		console.log(`\\n${chalk.yellow('⚠')} JSON output disabled, results saved to database only`);
	}
	
	// Note: Database is now created directly in public/ directory
	
		// Show completion outro
		console.log(`\\n${chalk.green('✓')} Benchmark completed successfully`);
		
	} catch (error) {
		// Catch-all for unexpected errors
		logger.failRun(error instanceof Error ? error.message : String(error), 'unknown');
		if (!quiet) console.log(chalk.red('✗ Unexpected error'));
		if (quiet) console.log(chalk.red(`[X] ${suite}/${scenario} (${tier}) ${agent}${model ? ` [${model}]` : ''} - FAILED: ${error instanceof Error ? error.message : String(error)}`));
	} finally {
		if (progress) completeProgress(progress);
	}
}

async function validateEnvironment() {
	const missingVars: string[] = [];
	
	// Check for API keys based on available agents
	if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
		missingVars.push('OPENROUTER_API_KEY or ANTHROPIC_API_KEY');
	}
	
	if (missingVars.length > 0) {
		console.log(chalk.red('❌ Missing required environment variables:'));
		console.log(chalk.yellow(`   ${missingVars.join(', ')}`));
		console.log('\\n' + chalk.cyan('Setup Instructions:'));
		console.log(chalk.gray('1. Get API keys from:'));
		console.log(chalk.gray('   - OpenRouter: https://openrouter.ai/keys'));
		console.log(chalk.gray('   - Anthropic: https://console.anthropic.com/settings/keys'));
		console.log(chalk.gray('2. Create a .env file in the project root:'));
		console.log(chalk.gray('   cp .env.example .env'));
		console.log(chalk.gray('3. Edit .env and add your API keys:'));
		console.log(chalk.gray('   OPENROUTER_API_KEY=your_key_here'));
		console.log(chalk.gray('   ANTHROPIC_API_KEY=your_key_here'));
		console.log(chalk.gray('4. Or set environment variables directly:'));
		console.log(chalk.gray('   Windows: set OPENROUTER_API_KEY=your_key_here'));
		console.log(chalk.gray('   Linux/Mac: export OPENROUTER_API_KEY=your_key_here'));
		console.log('\\n' + chalk.red('Please set up your environment variables and try again.'));
		process.exit(1);
	}
}

// ============================================================================
// SECTION 9: MAIN ENTRY POINT
// ============================================================================

async function run() {
	// Check for required environment variables first
	await validateEnvironment();
	
	// Dev server will be started only when viewing statistics
	
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
					if (!identifier[0]) {
					log.warning('Usage: pnpm bench --stats suite <suite-name>');
					return;
				}
					await runInteractiveSuiteStats();
				
			} else if (level === 'scenario') {
					if (!identifier[0] || !identifier[1]) {
					log.warning('Usage: pnpm bench --stats scenario <suite> <scenario>');
					return;
				}
					await runInteractiveScenarioStats();
				
			} else if (level === 'run') {
					if (!identifier[0]) {
					log.warning('Usage: pnpm bench --stats run <run-id>');
					return;
				}
					await runInteractiveRunStats();
				
			} else {
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
		const logger = BenchmarkLogger.getInstance();
		const limit = parsedArgs.limit;
		
		intro(chalk.bgCyan(' Benchmark History '));
		
		try {
			const runHistory = logger.getRunHistory(limit);
			
			if (runHistory.length === 0) {
				log.warning('No benchmark runs found');
				outro(chalk.yellow('Run a benchmark first: pnpm bench <suite> <scenario>'));
				return;
			}
			
			// Use common display function
			runHistory.forEach((run, index) => displayRunInfo(run, index));
			
			// Show overall stats
			const stats = logger.getStats();
			console.log('\\n' + chalk.underline('Overall Statistics'));
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
	
	// Handle batches command
	if (parsedArgs.cmd === 'batches') {
		const logger = BenchmarkLogger.getInstance();
		const limit = parsedArgs.limit;
		
		try {
			const batches = logger.getAllBatches({ limit });
			
			if (batches.length === 0) {
				log.warning('No batches found');
				outro(chalk.yellow('Run some benchmarks first'));
				return;
			}
			
			intro(chalk.bgCyan(' Batch History '));
			
			batches.forEach((batch, index) => {
				const status = batch.completedAt 
					? chalk.green('✓') 
					: chalk.yellow('○');
				const duration = batch.duration ? `${(batch.duration / 1000).toFixed(2)}s` : 'Running...';
				const successRate = batch.totalRuns > 0 ? ((batch.successfulRuns / batch.totalRuns) * 100).toFixed(0) : 0;
				
				console.log(`\\n${chalk.bold(`${index + 1}.`)} ${status} ${chalk.cyan('Batch')} ${chalk.dim(batch.batchId.substring(0, 8))}...`);
				console.log(`   ${formatStats('Runs', `${batch.successfulRuns}/${batch.totalRuns} (${successRate}%)`, 'green')}`);
				console.log(`   ${formatStats('Avg Score', batch.avgWeightedScore?.toFixed(4) || 'N/A', 'yellow')}`);
				console.log(`   ${formatStats('Duration', duration, 'blue')}`);
				console.log(`   ${chalk.gray(new Date(batch.createdAt).toLocaleString())}`);
			});
			
			outro(chalk.green(`Showing ${batches.length} batches`));
			
		} catch (error) {
			log.error(chalk.red('Failed to fetch batches:'));
			console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
			process.exit(1);
		} finally {
			logger.close();
		}
		return;
	}
	
	// Handle batch-details command
	if (parsedArgs.cmd === 'batch-details') {
		const logger = BenchmarkLogger.getInstance();
		const { batchId } = parsedArgs;
		
		if (!batchId) {
			log.warning('Usage: pnpm bench --batch-details <batch-id>');
			return;
		}
		
		try {
			const analytics = logger.getBatchAnalytics(batchId);
			
			if (!analytics) {
				log.error(chalk.red(`Batch ${batchId} not found`));
				return;
			}
			
			intro(chalk.bgCyan(' Batch Details '));
			
			const batch = analytics.batch;
			const duration = batch.duration / 1000;
			const successRate = batch.totalRuns > 0 ? ((batch.successfulRuns / batch.totalRuns) * 100).toFixed(1) : 0;
			
			console.log(`\\n${chalk.bold('Batch ID:')} ${chalk.dim(batchId.substring(0, 16))}...`);
			console.log(formatStats('Status', batch.completedAt ? 'Completed' : 'Running', batch.completedAt ? 'green' : 'yellow'));
			console.log(formatStats('Total Runs', `${batch.totalRuns}`, 'blue'));
			console.log(formatStats('Successful', `${batch.successfulRuns}/${batch.totalRuns} (${successRate}%)`, 'green'));
			console.log(formatStats('Avg Score', batch.avgWeightedScore.toFixed(4), 'yellow'));
			console.log(formatStats('Duration', `${duration.toFixed(2)}s`, 'blue'));
			console.log(formatStats('Started', new Date(batch.createdAt).toLocaleString()));
			
			// Suite breakdown
			if (analytics.suiteBreakdown.length > 0) {
				console.log(`\\n${chalk.bold.underline('Suite Breakdown')}`);
				analytics.suiteBreakdown.forEach(suite => {
					const rate = suite.runs > 0 ? ((suite.successfulRuns / suite.runs) * 100).toFixed(0) : 0;
					console.log(`  ${chalk.cyan(suite.suite)}/${suite.scenario}: ${suite.avgWeightedScore.toFixed(2)}/10 ${chalk.gray(`(${rate}% success, ${suite.runs} runs)`)}`);
				});
			}
			
			// Agent performance
			if (analytics.agentPerformance.length > 0) {
				console.log(`\\n${chalk.bold.underline('Agent Performance')}`);
				analytics.agentPerformance.forEach((agent, i) => {
					const rankDisplay = i < 3 ? `#${i + 1}` : `${i + 1}.`;
					const modelStr = agent.model && agent.model !== 'default' ? ` [${agent.model}]` : '';
					const scoreColor = agent.avgWeightedScore >= 9 ? 'green' : agent.avgWeightedScore >= 7 ? 'yellow' : 'red';
					console.log(`  ${rankDisplay} ${chalk.cyan(agent.agent)}${modelStr}: ${chalk[scoreColor](agent.avgWeightedScore.toFixed(2))}/10 ${chalk.gray(`(${agent.successfulRuns}/${agent.runs})`)}`);
				});
			}
			
			// Tier distribution
			if (analytics.tierDistribution.length > 0) {
				console.log(`\\n${chalk.bold.underline('Tier Distribution')}`);
				analytics.tierDistribution.forEach(tier => {
					console.log(`  ${chalk.cyan(tier.tier)}: ${tier.avgWeightedScore.toFixed(2)}/10 ${chalk.gray(`(${tier.successfulRuns}/${tier.runs} runs)`)}`);
				});
			}
			
			// Failed runs
			if (analytics.failedRuns.length > 0) {
				console.log(`\\n${chalk.bold.underline(chalk.red('Failed Runs'))}`);
				analytics.failedRuns.forEach(run => {
					console.log(`  ${chalk.red('✗')} ${run.suite}/${run.scenario} (${run.tier}) ${run.agent}`);
				});
			}
			
			outro(chalk.green('Batch analytics complete'));
			
		} catch (error) {
			log.error(chalk.red('Failed to fetch batch details:'));
			console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
			process.exit(1);
		} finally {
			logger.close();
		}
		return;
	}
	
	// Handle compare-batches command
	if (parsedArgs.cmd === 'compare-batches') {
		const logger = BenchmarkLogger.getInstance();
		const { batchIds } = parsedArgs;
		
		if (!batchIds || batchIds.length < 2) {
			log.warning('Usage: pnpm bench --compare-batches <batch-id1> <batch-id2> [batch-id3...]');
			return;
		}
		
		try {
			const batches = logger.getBatchComparison(batchIds);
			
			if (batches.length === 0) {
				log.error(chalk.red('No batches found with the provided IDs'));
				return;
			}
			
			intro(chalk.bgMagenta(' Batch Comparison '));
			
			console.log(`\\n${chalk.bold('Comparing')} ${batches.length} batches:\\n`);
			
			// Create comparison table
			console.log(chalk.bold('Batch'.padEnd(12)) + ' | ' + 
			           chalk.bold('Runs'.padEnd(8)) + ' | ' + 
			           chalk.bold('Success'.padEnd(10)) + ' | ' + 
			           chalk.bold('Avg Score'.padEnd(10)) + ' | ' + 
			           chalk.bold('Duration'));
			console.log('─'.repeat(70));
			
			batches.forEach(batch => {
				const batchIdShort = batch.batchId.substring(0, 8) + '...';
				const successRate = batch.totalRuns > 0 ? ((batch.successfulRuns / batch.totalRuns) * 100).toFixed(0) + '%' : 'N/A';
				const duration = batch.duration ? `${(batch.duration / 1000).toFixed(0)}s` : 'N/A';
				const score = batch.avgWeightedScore?.toFixed(2) || 'N/A';
				
				console.log(
					chalk.dim(batchIdShort.padEnd(12)) + ' | ' + 
					`${batch.totalRuns}`.padEnd(8) + ' | ' + 
					successRate.padEnd(10) + ' | ' + 
					chalk.yellow(score.padEnd(10)) + ' | ' + 
					duration
				);
			});
			
			// Show best performer
			const bestBatch = batches.reduce((best, current) => 
				(current.avgWeightedScore || 0) > (best.avgWeightedScore || 0) ? current : best
			);
			
			console.log(`\\n${chalk.green('Best performing batch:')} ${chalk.dim(bestBatch.batchId.substring(0, 8))}... with score ${chalk.bold(bestBatch.avgWeightedScore?.toFixed(4) || 'N/A')}`);
			
			outro(chalk.green('Comparison complete'));
			
		} catch (error) {
			log.error(chalk.red('Failed to compare batches:'));
			console.error(chalk.dim(error instanceof Error ? error.message : String(error)));
			process.exit(1);
		} finally {
			logger.close();
		}
		return;
	}
	
	const { cmd, suite, scenario, tier, agent, model, noJson } = parsedArgs;
	if (cmd !== 'bench' || !suite || !scenario) {
		showHelp();
		process.exit(1);
	}
	
	// Show modern CLI intro with hyperfine-style header
	console.log(chalk.bold.underline('Demo: Benchmarking AI Agents:'));
	console.log(`\\n${chalk.green('►')} ${chalk.green('pnpm bench')} ${chalk.yellow(`'${suite}/${scenario}'`)} ${chalk.yellow(`'${tier}'`)} ${chalk.yellow(`'${agent}'`)}`);
	
	log.info(chalk.bold(`Running: ${suite}/${scenario}`));
	log.info(`${chalk.gray('Tier:')} ${chalk.cyan(tier)} ${chalk.gray('Agent:')} ${chalk.cyan(agent)}`);
	
	// Warn if OpenRouter agent but no model specified
	if (agent === 'openrouter' && !model && !process.env.OPENROUTER_MODEL) {
		console.log(chalk.yellow(`\\n⚠️  Warning: No model specified for OpenRouter agent. Using default model.`));
		console.log(chalk.gray(`   Tip: Use --model flag or set OPENROUTER_MODEL environment variable`));
		console.log(chalk.gray(`   Example: pnpm bench ${suite}/${scenario} ${tier} ${agent} --model openai/gpt-4o-mini\\n`));
	}
	
	// Execute the benchmark
	await executeBenchmark(suite, scenario, tier, agent, model, noJson);
}

// Cleanup handlers
process.on('exit', () => {
	stopDevServer();
});

process.on('SIGINT', () => {
	console.log('\\nShutting down...');
	stopDevServer();
	process.exit(0);
});

process.on('SIGTERM', () => {
	console.log('\\nShutting down...');
	stopDevServer();
	process.exit(0);
});

process.on('uncaughtException', (err) => {
	console.error('\\nUncaught Exception:', err);
	stopDevServer();
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('\\nUnhandled Rejection at:', promise, 'reason:', reason);
	stopDevServer();
	process.exit(1);
});

run().catch((err) => {
	console.log(`\\n${chalk.red('✗')} Benchmark failed: ${err instanceof Error ? err.message : String(err)}`);
	
	// Try to log the error to database if logger is available
	try {
		const logger = BenchmarkLogger.getInstance();
		logger.failRun(String(err));
	} catch (logErr) {
		console.log(`${chalk.yellow('⚠')} Failed to log error to database: ${logErr instanceof Error ? logErr.message : String(logErr)}`);
	}
	
	stopDevServer();
	process.exit(1);
});
