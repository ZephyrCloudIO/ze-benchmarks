import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { select, multiselect, isCancel, cancel, text } from '@clack/prompts';
import chalk from 'chalk';
import { BenchmarkLogger } from '@ze/worker-client';
import { OpenRouterAPI } from '../lib/openrouter-api.ts';
import { log } from '@clack/prompts';
import { executeBenchmark } from '../execution/benchmark.ts';
import { findRepoRoot } from '../lib/workspace-utils.ts';
import { getAvailableTiers, getTierLabel, loadScenario } from '../domain/scenario.ts';
import { createTitle } from '../lib/display.ts';
import { executeWarmup } from '../domain/warmup.ts';
import { createAgentAdapter } from '../domain/agent.ts';

const TABLE_WIDTH = 60;

// ============================================================================
// PARALLEL EXECUTION HELPER
// ============================================================================

export async function executeWithConcurrency<T>(
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

// ============================================================================
// MULTIPLE BENCHMARKS EXECUTION
// ============================================================================

export async function executeMultipleBenchmarks(
	suites: string[],
	scenarios: string[],
	tiers: string[],
	agents: string[],
	models: (string | undefined)[]
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
	console.log(chalk.bold.underline(`\nRunning ${combinations.length} benchmark(s):`));
	if (useParallel) {
		console.log(chalk.gray(`Parallel execution with concurrency: ${concurrency}`));
	}

	// Execute warmup once per unique suite/scenario before running benchmarks
	const uniqueScenarios = new Set(combinations.map(c => `${c.suite}/${c.scenario}`));
	if (uniqueScenarios.size > 0) {
		console.log(chalk.blue('\n🔥 Running warmup phase for scenarios...'));
		for (const scenarioKey of uniqueScenarios) {
			const [suite, scenario] = scenarioKey.split('/');
			try {
				const scenarioCfg = loadScenario(suite, scenario);
				const warmupResult = await executeWarmup(suite, scenario, scenarioCfg, createAgentAdapter, true);
				if (!warmupResult.success) {
					console.log(chalk.yellow(`⚠️  Warmup for ${scenarioKey}: ${warmupResult.error || 'failed'}`));
				} else {
					console.log(chalk.green(`✓ Warmup completed for ${scenarioKey}`));
				}
			} catch (error) {
				console.log(chalk.yellow(`⚠️  Warmup error for ${scenarioKey}: ${error instanceof Error ? error.message : String(error)}`));
			}
		}
		console.log();
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
				await executeBenchmark(suite, scenario, tier, agent, model, batchId, true, undefined, true); // quiet mode, skip warmup
			}
		);
	} else {
		// Sequential execution
		for (let i = 0; i < combinations.length; i++) {
			const { suite, scenario, tier, agent, model } = combinations[i];

			console.log(`${chalk.bold.cyan(`[${i + 1}/${combinations.length}]`)} ${suite}/${scenario} ${chalk.gray(`(${tier}) ${agent}${model ? ` [${model}]` : ''}`)}`);

			await executeBenchmark(suite, scenario, tier, agent, model, batchId, true, undefined, true); // quiet mode, skip warmup
		}
	}

	// Complete batch tracking
	const endTime = Date.now();
	const duration = endTime - startTime;

	// Calculate batch statistics
	const batchStats = logger.getBatchDetails(batchId);
	if (batchStats) {
		// Calculate successful runs directly from individual runs in the batch
		// This ensures we use the new is_successful field
		successfulRuns = logger.getBatchSuccessfulRunsCount(batchId);

		// Calculate average scores directly from individual runs in the batch
		const scoreStats = logger.getBatchScoreStats(batchId);
		totalScore = scoreStats.avgScore;
		totalWeightedScore = scoreStats.avgWeightedScore;
	}

	logger.completeBatch(batchId, {
		totalRuns: combinations.length,
		successfulRuns,
		avgScore: totalScore,
		avgWeightedScore: totalWeightedScore,
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
	console.log('\n' + chalk.bold.underline('Batch Summary'));
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
		console.log(`\n${chalk.bold.underline('Suite Breakdown')}`);
		analytics.suiteBreakdown.forEach(suite => {
			const successRate = suite.runs > 0 ? ((suite.successfulRuns / suite.runs) * 100).toFixed(0) : 0;
			console.log(`  ${chalk.cyan(suite.suite)}/${suite.scenario}: ${suite.avgWeightedScore.toFixed(2)}/10 ${chalk.gray(`(${successRate}% success, ${suite.runs} runs)`)}`);
		});
	}

	// Show agent performance
	if (analytics && analytics.agentPerformance.length > 0) {
		console.log(`\n${chalk.bold.underline('Agent Performance')}`);
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
		console.log(`\n${chalk.bold.underline(chalk.red('Failed Runs'))}`);
		analytics.failedRuns.forEach(run => {
			console.log(`  ${chalk.red('✗')} ${run.suite}/${run.scenario} (${run.tier}) ${run.agent} - ${run.error || 'Unknown error'}`);
		});
	}

	// Show completion summary
	console.log('\n' + chalk.green('✓') + chalk.bold(` Completed all ${combinations.length} benchmark(s)!`));

	// Note: Database is now created directly in public/ directory
}

// ============================================================================
// INTERACTIVE BENCHMARK
// ============================================================================

export async function runInteractiveBenchmark() {
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

	// Expand "All" selection
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

	// Expand "All" selection and filter by suite
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

	// Expand "All" selection
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

	// Expand "All" selection
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
		console.log(`\n${chalk.gray('Quick searches:')} ${Object.keys(QUICK_MODELS).join(', ')}`);

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
			log.warning(`No models found matching "${modelSearch}"`);
			log.info('Try searching for: gpt-4o, llama, gemma, claude, mistral');
			return;
		}

		// Show search results with pricing info
		console.log(`\n📋 Found ${searchResults.length} matching models:\n`);

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
			console.log(`\n${chalk.bold.cyan('Model Details:')}`);
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
	console.log(`\n${chalk.green('►')} Will run ${chalk.bold(totalCombinations.toString())} benchmark combination(s)`);
	console.log(`   ${chalk.cyan('Suites:')} ${suitesToUse.join(', ')}`);
	console.log(`   ${chalk.cyan('Scenarios:')} ${scenariosToUse.join(', ')}`);
	console.log(`   ${chalk.cyan('Tiers:')} ${tiersToUse.join(', ')}`);
	console.log(`   ${chalk.cyan('Agents:')} ${agentsToUse.join(', ')}`);
	if (needsOpenRouterModels || needsAnthropicModels || needsClaudeCodeModels) {
		console.log(`   ${chalk.cyan('Models:')} ${modelsToUse.join(', ')}`);
	}
	console.log(`   ${chalk.cyan('Parallel execution:')} ${useParallel ? `Yes (concurrency: ${concurrency})` : 'No'}`);

	// Show title before execution
	console.log(chalk.cyan(createTitle()));

	// Execute all benchmark combinations
	await executeMultipleBenchmarks(
		suitesToUse,
		scenariosToUse,
		tiersToUse,
		agentsToUse,
		modelsToUse
	);
}

// ============================================================================
// HELPER FUNCTIONS
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
