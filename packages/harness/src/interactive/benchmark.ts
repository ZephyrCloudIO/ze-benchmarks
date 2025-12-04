import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { select, multiselect, isCancel, cancel, text } from '@clack/prompts';
import chalk from 'chalk';
import JSON5 from 'json5';
import { BenchmarkLogger } from '@ze/worker-client';
import { OpenRouterAPI } from '../lib/openrouter-api.ts';
import { log } from '@clack/prompts';
import { executeBenchmark } from '../execution/benchmark.ts';
import { findRepoRoot } from '../lib/workspace-utils.ts';
import { getAvailableTiers, getTierLabel, loadScenario } from '../domain/scenario.ts';
import { createTitle } from '../lib/display.ts';
import { executeWarmup } from '../domain/warmup.ts';
import { createAgentAdapter } from '../domain/agent.ts';
import { logger } from '@ze/logger';

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

export async function executeMultipleBenchmarksWithSpecialists(
	suites: string[],
	scenarios: string[],
	tiers: string[],
	specialists: string[],
	enrichTemplate?: string
) {
	// Initialize batch tracking
	const benchmarkLogger = BenchmarkLogger.getInstance();
	const batchId = await benchmarkLogger.startBatch();

	// Calculate total combinations
	const combinations: Array<{
		suite: string;
		scenario: string;
		tier: string;
		specialist: string;
	}> = [];

	for (const suite of suites) {
		for (const scenario of scenarios) {
			const availableTiers = getAvailableTiers(suite, scenario);
			const availableTierValues = availableTiers.map(t => t.value);
			const validTiers = tiers.filter(tier => availableTierValues.includes(tier));

			if (validTiers.length === 0) {
				logger.interactive.warn(`⚠ Skipping ${suite}/${scenario}: no valid tiers`);
				continue;
			}

			for (const tier of validTiers) {
				for (const specialist of specialists) {
					combinations.push({ suite, scenario, tier, specialist });
				}
			}
		}
	}

	// Smart concurrency
	const useParallel = combinations.length >= 3;
	let concurrency = combinations.length <= 5 ? 2 : combinations.length <= 15 ? 3 : 5;

	logger.interactive.raw(chalk.bold.underline(`\nRunning ${combinations.length} benchmark(s) with specialists:`));
	if (useParallel) {
		logger.interactive.debug(`Parallel execution with concurrency: ${concurrency}`);
	}

	// Execute warmup once per unique suite/scenario
	const uniqueScenarios = new Set(combinations.map(c => `${c.suite}/${c.scenario}`));
	if (uniqueScenarios.size > 0) {
		logger.interactive.info('\n🔥 Running warmup phase for scenarios...');
		for (const scenarioKey of uniqueScenarios) {
			const [suite, scenario] = scenarioKey.split('/');
			try {
				const scenarioCfg = loadScenario(suite, scenario);
				const warmupResult = await executeWarmup(suite, scenario, scenarioCfg, createAgentAdapter, true);
				if (!warmupResult.success) {
					logger.interactive.warn(`⚠️  Warmup for ${scenarioKey}: ${warmupResult.error || 'failed'}`);
				} else {
					logger.interactive.success(`✓ Warmup completed for ${scenarioKey}`);
				}
			} catch (error) {
				logger.interactive.warn(`⚠️  Warmup error for ${scenarioKey}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		logger.interactive.raw();
	}

	// Track batch statistics
	const startTime = Date.now();

	// Execute benchmarks
	if (useParallel) {
		await executeWithConcurrency(
			combinations,
			concurrency,
			async (combo, i) => {
				const { suite, scenario, tier, specialist } = combo;
				logger.interactive.raw(`${chalk.bold.cyan(`[${i + 1}/${combinations.length}]`)} ${suite}/${scenario} ${chalk.gray(`(${tier}) ${specialist}`)}`);
				await executeBenchmark(
					suite,
					scenario,
					tier,
					undefined,  // agent is undefined - specialist will auto-detect
					undefined,  // model is undefined - specialist has preferred model
					batchId,
					true,       // quiet mode
					specialist, // specialist parameter
					true,       // skip warmup (already done)
					true        // llmJudgeOnly
				);
			}
		);
	} else {
		for (let i = 0; i < combinations.length; i++) {
			const { suite, scenario, tier, specialist } = combinations[i];
			logger.interactive.raw(`${chalk.bold.cyan(`[${i + 1}/${combinations.length}]`)} ${suite}/${scenario} ${chalk.gray(`(${tier}) ${specialist}`)}`);
			await executeBenchmark(
				suite,
				scenario,
				tier,
				undefined,  // agent is undefined - specialist will auto-detect
				undefined,  // model is undefined - specialist has preferred model
				batchId,
				true,       // quiet mode
				specialist, // specialist parameter
				true,       // skip warmup (already done)
				true        // llmJudgeOnly
			);
		}
	}

	// Complete batch and show summary
	const endTime = Date.now();
	const duration = endTime - startTime;
	const batchStats = await benchmarkLogger.getBatchDetails(batchId);

	let successfulRuns = 0;
	let totalScore = 0;
	let totalWeightedScore = 0;

	if (batchStats) {
		successfulRuns = await benchmarkLogger.getBatchSuccessfulRunsCount(batchId);
		const scoreStats = await benchmarkLogger.getBatchScoreStats(batchId);
		totalScore = scoreStats.avgScore || 0;
		totalWeightedScore = scoreStats.avgWeightedScore || 0;
	}

	await benchmarkLogger.completeBatch(batchId, {
		totalRuns: combinations.length,
		successfulRuns,
		avgScore: totalScore,
		avgWeightedScore: totalWeightedScore,
		metadata: {
			suites,
			scenarios,
			tiers,
			specialists,
			executionMode: 'specialist',
			duration
		}
	});

	// Show summary
	const analytics = await benchmarkLogger.getBatchAnalytics(batchId);

	logger.interactive.raw('\n' + chalk.bold.underline('Batch Summary'));
	logger.interactive.raw(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
	logger.interactive.raw(`│ ${chalk.bold('Batch ID:')} ${chalk.dim(batchId.substring(0, 8))}...`);
	logger.interactive.raw(`│ ${chalk.bold('Mode:')} ${chalk.cyan('Specialists')}`);
	logger.interactive.raw(`│ ${chalk.bold('Total Runs:')} ${combinations.length}`);
	logger.interactive.raw(`│ ${chalk.bold('Completed:')} ${successfulRuns} (${combinations.length > 0 ? ((successfulRuns / combinations.length) * 100).toFixed(1) : 0}%)`);

	const failedRuns = combinations.length - successfulRuns;
	if (failedRuns > 0) {
		logger.interactive.raw(`│ ${chalk.bold('Failed:')} ${chalk.red(failedRuns)} (${combinations.length > 0 ? ((failedRuns / combinations.length) * 100).toFixed(1) : 0}%)`);
	}

	logger.interactive.raw(`│ ${chalk.bold('Avg Score:')} ${combinations.length > 0 ? (totalWeightedScore / combinations.length).toFixed(4) : '0.0000'} / 10.0`);
	logger.interactive.raw(`│ ${chalk.bold('Duration:')} ${(duration / 1000).toFixed(2)}s`);
	logger.interactive.raw(`└${'─'.repeat(TABLE_WIDTH)}┘`);

	// Show suite breakdown if analytics available
	if (analytics && analytics.suiteBreakdown && analytics.suiteBreakdown.length > 0) {
		logger.interactive.raw(`\n${chalk.bold.underline('Suite Breakdown')}`);
		analytics.suiteBreakdown.forEach((suite: { suite: string; scenario: string; runs: number; successfulRuns: number; avgWeightedScore: number }) => {
			const successRate = suite.runs > 0 ? ((suite.successfulRuns / suite.runs) * 100).toFixed(0) : 0;
			logger.interactive.raw(`  ${chalk.cyan(suite.suite)}/${suite.scenario}: ${suite.avgWeightedScore?.toFixed(2) || 0}/10 ${chalk.gray(`(${successRate}% success, ${suite.runs} runs)`)}`);
		});
	}

	// Show agent performance (specialists in this case)
	if (analytics && analytics.agentBreakdown && analytics.agentBreakdown.length > 0) {
		logger.interactive.raw(`\n${chalk.bold.underline('Specialist Performance')}`);
		analytics.agentBreakdown.forEach((agent: any, index: number) => {
			const rank = index + 1;
			const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
			const scoreColor = (agent.avgWeightedScore || 0) >= 9 ? 'green' : (agent.avgWeightedScore || 0) >= 7 ? 'yellow' : 'red';
			logger.interactive.raw(`  ${rankDisplay} ${chalk.cyan(agent.agent)}: ${chalk[scoreColor]((agent.avgWeightedScore || 0).toFixed(2))}/10 ${chalk.gray(`(${agent.successfulRuns || 0}/${agent.totalRuns || 0} runs)`)}`);
		});
	}

	// Show failed runs if any
	if (analytics && analytics.runs) {
		const failedRunsList = analytics.runs.filter((run: any) => run.status === 'failed');
		if (failedRunsList.length > 0) {
			logger.interactive.raw(`\n${chalk.bold.underline(chalk.red('Failed Runs'))}`);
			failedRunsList.forEach((run: any) => {
				logger.interactive.raw(`  ${chalk.red('✗')} ${run.suite}/${run.scenario} (${run.tier}) ${run.agent} - ${run.error || 'Unknown error'}`);
			});
		}
	}

	logger.interactive.raw('\n' + chalk.green('✓') + chalk.bold(` Completed all ${combinations.length} benchmark(s) with specialists!`));

	// Enrich template if requested
	if (enrichTemplate) {
		logger.interactive.info(`\n🔍 Enriching template: ${enrichTemplate}`);

		try {
			// Resolve specialist name to template path
			const root = findRepoRoot();
			const { resolveSpecialistTemplatePath } = await import('../domain/agent.ts');
			const templatePath = resolveSpecialistTemplatePath(enrichTemplate, root);

			// Import enrichment function
			const { enrichTemplate: enrichTemplateFunc } = await import('../../../specialist-mint/src/enrich-template.js');

			const result = await enrichTemplateFunc(templatePath, {
				provider: (process.env.ENRICHMENT_PROVIDER as 'openrouter' | 'anthropic') || 'openrouter',
				model: process.env.ENRICHMENT_MODEL || 'anthropic/claude-3.5-haiku',
				force: false,
				timeoutMs: 30000,
				concurrency: 3
			});

			logger.interactive.success('\n✅ Template enrichment completed!');
			logger.interactive.debug(`   Enriched template: ${result.enrichedTemplatePath}`);
			logger.interactive.debug(`   Documents enriched: ${result.documentsEnriched}`);
			logger.interactive.debug(`   Documents skipped: ${result.documentsSkipped}`);

			if (result.errors.length > 0) {
				logger.interactive.warn(`   Errors: ${result.errors.length}`);
				result.errors.forEach((err: { index: number; error: string }) => {
					logger.interactive.warn(`     - [${err.index + 1}] ${err.error}`);
				});
			}
		} catch (error) {
			logger.interactive.error('\n❌ Error enriching template:');
			logger.interactive.error(`   ${error instanceof Error ? error.message : String(error)}`);
			logger.interactive.warn('\n💡 Tip: Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY in .env');
		}
	}
}

export async function executeMultipleBenchmarks(
	suites: string[],
	scenarios: string[],
	tiers: string[],
	agents: string[],
	models: (string | undefined)[]
) {
	// Initialize batch tracking
	const benchmarkLogger = BenchmarkLogger.getInstance();
	const batchId = await benchmarkLogger.startBatch();

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
				logger.interactive.warn(`⚠ Skipping ${suite}/${scenario}: no valid tiers (available: ${availableTierValues.join(', ')})`);
				continue;
			}

			// Log if some tiers are being skipped
			const skippedTiers = tiers.filter(tier => !availableTierValues.includes(tier));
			if (skippedTiers.length > 0) {
				logger.interactive.debug(`  Skipping tiers for ${suite}/${scenario}: ${skippedTiers.join(', ')}`);
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
	logger.interactive.raw(chalk.bold.underline(`\nRunning ${combinations.length} benchmark(s):`));
	if (useParallel) {
		logger.interactive.debug(`Parallel execution with concurrency: ${concurrency}`);
	}

	// Execute warmup once per unique suite/scenario before running benchmarks
	const uniqueScenarios = new Set(combinations.map(c => `${c.suite}/${c.scenario}`));
	if (uniqueScenarios.size > 0) {
		logger.interactive.info('\n🔥 Running warmup phase for scenarios...');
		for (const scenarioKey of uniqueScenarios) {
			const [suite, scenario] = scenarioKey.split('/');
			try {
				const scenarioCfg = loadScenario(suite, scenario);
				const warmupResult = await executeWarmup(suite, scenario, scenarioCfg, createAgentAdapter, true);
				if (!warmupResult.success) {
					logger.interactive.warn(`⚠️  Warmup for ${scenarioKey}: ${warmupResult.error || 'failed'}`);
				} else {
					logger.interactive.success(`✓ Warmup completed for ${scenarioKey}`);
				}
			} catch (error) {
				logger.interactive.warn(`⚠️  Warmup error for ${scenarioKey}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		logger.interactive.raw();
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
				logger.interactive.raw(`${chalk.bold.cyan(`[${i + 1}/${combinations.length}]`)} ${suite}/${scenario} ${chalk.gray(`(${tier}) ${agent}${model ? ` [${model}]` : ''}`)}`);
				await executeBenchmark(suite, scenario, tier, agent, model, batchId, true, undefined, true, true); // quiet mode, skip warmup, llmJudgeOnly
			}
		);
	} else {
		// Sequential execution
		for (let i = 0; i < combinations.length; i++) {
			const { suite, scenario, tier, agent, model } = combinations[i];

			logger.interactive.raw(`${chalk.bold.cyan(`[${i + 1}/${combinations.length}]`)} ${suite}/${scenario} ${chalk.gray(`(${tier}) ${agent}${model ? ` [${model}]` : ''}`)}`);

			await executeBenchmark(suite, scenario, tier, agent, model, batchId, true, undefined, true, true); // quiet mode, skip warmup, llmJudgeOnly
		}
	}

	// Complete batch tracking
	const endTime = Date.now();
	const duration = endTime - startTime;

	// Calculate batch statistics
	const batchStats = await benchmarkLogger.getBatchDetails(batchId);
	if (batchStats) {
		// Calculate successful runs directly from individual runs in the batch
		// This ensures we use the new is_successful field
		successfulRuns = await benchmarkLogger.getBatchSuccessfulRunsCount(batchId);

		// Calculate average scores directly from individual runs in the batch
		const scoreStats = await benchmarkLogger.getBatchScoreStats(batchId);
		totalScore = scoreStats.avgScore || 0;
		totalWeightedScore = scoreStats.avgWeightedScore || 0;
	}

	await benchmarkLogger.completeBatch(batchId, {
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
	const analytics = await benchmarkLogger.getBatchAnalytics(batchId);

	// Show batch summary header
	logger.interactive.raw('\n' + chalk.bold.underline('Batch Summary'));
	logger.interactive.raw(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
	logger.interactive.raw(`│ ${chalk.bold('Batch ID:')} ${chalk.dim(batchId.substring(0, 8))}...`);

	// Show model if all runs used the same model
	const uniqueModels = [...new Set(combinations.map(c => c.model).filter(m => m))];
	if (uniqueModels.length === 1) {
		logger.interactive.raw(`│ ${chalk.bold('Model:')} ${chalk.cyan(uniqueModels[0])}`);
	}

	logger.interactive.raw(`│ ${chalk.bold('Total Runs:')} ${combinations.length}`);
	logger.interactive.raw(`│ ${chalk.bold('Completed:')} ${successfulRuns} (${combinations.length > 0 ? ((successfulRuns / combinations.length) * 100).toFixed(1) : 0}%)`);

	// Show failed runs breakdown
	const failedRuns = combinations.length - successfulRuns;
	if (failedRuns > 0) {
		logger.interactive.raw(`│ ${chalk.bold('Failed:')} ${chalk.red(failedRuns)} (${combinations.length > 0 ? ((failedRuns / combinations.length) * 100).toFixed(1) : 0}%)`);

		// Get failure breakdown
		const failureBreakdown = await benchmarkLogger.getFailureBreakdown(batchId);
		if (failureBreakdown.length > 0) {
			const failureReasons = failureBreakdown.map(f => `${f.errorType}: ${f.count}`).join(', ');
			logger.interactive.raw(`│ ${chalk.bold('Failure Reasons:')} ${chalk.red(failureReasons)}`);
		}
	}

	logger.interactive.raw(`│ ${chalk.bold('Avg Score:')} ${combinations.length > 0 ? (totalWeightedScore / combinations.length).toFixed(4) : 0} / 10.0`);
	logger.interactive.raw(`│ ${chalk.bold('Duration:')} ${(duration / 1000).toFixed(2)}s`);
	logger.interactive.raw(`└${'─'.repeat(TABLE_WIDTH)}┘`);

	// Show suite breakdown if analytics available
	if (analytics && analytics.suiteBreakdown && analytics.suiteBreakdown.length > 0) {
		logger.interactive.raw(`\n${chalk.bold.underline('Suite Breakdown')}`);
		analytics.suiteBreakdown.forEach((suite: { suite: string; scenario: string; runs: number; successfulRuns: number; avgWeightedScore: number }) => {
			const successRate = suite.runs > 0 ? ((suite.successfulRuns / suite.runs) * 100).toFixed(0) : 0;
			logger.interactive.raw(`  ${chalk.cyan(suite.suite)}/${suite.scenario}: ${suite.avgWeightedScore?.toFixed(2) || 0}/10 ${chalk.gray(`(${successRate}% success, ${suite.runs} runs)`)}`);
		});
	}

	// Show agent performance
	if (analytics && analytics.agentBreakdown && analytics.agentBreakdown.length > 0) {
		logger.interactive.raw(`\n${chalk.bold.underline('Agent Performance')}`);
		analytics.agentBreakdown.forEach((agent: any, index: number) => {
			const rank = index + 1;
			const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
			const modelStr = agent.model && agent.model !== 'default' ? ` [${agent.model}]` : '';
			const scoreColor = (agent.avgWeightedScore || 0) >= 9 ? 'green' : (agent.avgWeightedScore || 0) >= 7 ? 'yellow' : 'red';
			logger.interactive.raw(`  ${rankDisplay} ${chalk.cyan(agent.agent)}${modelStr}: ${chalk[scoreColor]((agent.avgWeightedScore || 0).toFixed(2))}/10 ${chalk.gray(`(${agent.successfulRuns || 0}/${agent.totalRuns || 0} runs)`)}`);
		});
	}

	// Show failed runs if any (filter from runs array)
	if (analytics && analytics.runs) {
		const failedRuns = analytics.runs.filter((run: any) => run.status === 'failed');
		if (failedRuns.length > 0) {
			logger.interactive.raw(`\n${chalk.bold.underline(chalk.red('Failed Runs'))}`);
			failedRuns.forEach((run: any) => {
				logger.interactive.raw(`  ${chalk.red('✗')} ${run.suite}/${run.scenario} (${run.tier}) ${run.agent} - ${run.error || 'Unknown error'}`);
			});
		}
	}

	// Show completion summary
	logger.interactive.raw('\n' + chalk.green('✓') + chalk.bold(` Completed all ${combinations.length} benchmark(s)!`));

	// Note: Database is now created directly in public/ directory
}

// ============================================================================
// INTERACTIVE BENCHMARK
// ============================================================================

export async function runInteractiveBenchmark(executionMode?: 'specialist' | 'direct') {
	logger.interactive.raw(chalk.bold.underline('Demo: Benchmarking AI Agents:'));

	// If execution mode not provided, ask user to choose
	if (!executionMode) {
		executionMode = await select({
			message: 'Choose execution mode:',
			options: [
				{
					value: 'specialist',
					label: 'Specialists (Recommended)',
					hint: 'Use pre-configured specialist templates for specific tasks'
				},
				{
					value: 'direct',
					label: 'Direct Agents',
					hint: 'Use base agents directly (openrouter, anthropic, etc.)'
				}
			]
		}) as 'specialist' | 'direct';

		if (isCancel(executionMode)) {
			cancel('Operation cancelled.');
			return;
		}
	}

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
	logger.interactive.raw('🔍 Scanning available tiers for selected scenarios...');
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
		logger.interactive.raw(`  ${scenario}: ${tiers.join(', ')}`);
	});

	const tierOptions = [
		{ value: '__ALL__', label: 'All available tiers' },
		...Array.from(availableTiersSet).sort().map(tier => ({
			value: tier,
			label: getTierLabel(tier)
		}))
	];

	logger.interactive.raw(`✅ Found ${availableTiersSet.size} unique tiers across all scenarios`);

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

	// Now select agents/specialists based on execution mode (already selected at the start)
	let agentsToUse: string[] = [];
	let specialistsToUse: string[] = [];
	let modelsToUse: (string | undefined)[] = [undefined];

	if (executionMode === 'specialist') {
		// Specialist mode
		logger.interactive.raw('🔍 Loading available specialists...');
		const specialistOptions = await getAvailableSpecialists();

		if (specialistOptions.length === 0) {
			log.warning('No specialists found in templates directory');
			log.info('Add a specialist template to the templates/ directory first');
			return;
		}

		logger.interactive.raw(`✅ Found ${specialistOptions.length} specialist(s)`);

		const selectedSpecialists = await multiselect({
			message: 'Choose specialists:',
			options: [
				{ value: '__ALL__', label: 'All specialists' },
				...specialistOptions
			],
			required: true
		});

		if (isCancel(selectedSpecialists)) {
			cancel('Operation cancelled.');
			return;
		}

		// Expand "All" selection
		specialistsToUse = selectedSpecialists.includes('__ALL__')
			? specialistOptions.map(s => s.value)
			: selectedSpecialists;

		logger.interactive.raw(`🎯 Selected specialists: ${specialistsToUse.join(', ')}`);

	} else {
		// Direct agent mode (existing code)
		logger.interactive.raw('Loading available agents...');
		const agentOptions = await getAvailableAgents();
		logger.interactive.raw(`✅ Loaded ${agentOptions.length} agent options`);

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
		agentsToUse = selectedAgents.includes('__ALL__')
			? ['echo', 'openrouter', 'anthropic', 'claude-code']
			: selectedAgents;

		logger.interactive.raw(`🎯 Selected agents: ${agentsToUse.join(', ')}`);
	}

	// Ask for models if needed (only in direct agent mode)
	if (executionMode === 'direct') {
	const needsOpenRouterModels = agentsToUse.some(agent => agent === 'openrouter');
	const needsAnthropicModels = agentsToUse.some(agent => agent === 'anthropic');
	const needsClaudeCodeModels = agentsToUse.some(agent => agent === 'claude-code');

	if (needsOpenRouterModels) {
		logger.interactive.raw('🔍 Loading OpenRouter models with tool support...');

		const openrouterAPI = new OpenRouterAPI(process.env.OPENROUTER_API_KEY || '');
		const toolModels = await openrouterAPI.getModelsWithToolSupport();

		logger.interactive.raw(`✅ Found ${toolModels.length} models with tool support`);

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
		logger.interactive.raw(`\n${chalk.gray('Quick searches:')} ${Object.keys(QUICK_MODELS).join(', ')}`);

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
		logger.interactive.raw(`\n📋 Found ${searchResults.length} matching models:\n`);

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
		logger.interactive.raw(`🎯 Selected model: ${selectedModel}`);

		// Display selected model details
		const selectedModelInfo = toolModels.find(m => m.id === selectedModel);

		if (selectedModelInfo) {
			logger.interactive.raw(`\n${chalk.bold.cyan('Model Details:')}`);
			logger.interactive.raw(`  ${chalk.gray('Name:')} ${selectedModelInfo.name}`);
			logger.interactive.raw(`  ${chalk.gray('ID:')} ${selectedModelInfo.id}`);
			logger.interactive.raw(`  ${chalk.gray('Context:')} ${selectedModelInfo.context_length.toLocaleString()} tokens`);
			logger.interactive.raw(`  ${chalk.gray('Cost:')} $${selectedModelInfo.pricing.prompt}/1K prompt, $${selectedModelInfo.pricing.completion}/1K completion`);

			const isFree = parseFloat(selectedModelInfo.pricing.prompt) === 0;
			if (isFree) {
				logger.interactive.raw(`  ${chalk.green('✓ FREE MODEL')}`);
			}
		}
	} else if (needsAnthropicModels) {
		logger.interactive.raw('🧠 Loading available Anthropic models...');
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
		logger.interactive.raw(`🎯 Selected Anthropic models: ${modelsToUse.join(', ')}`);
	} else if (needsClaudeCodeModels) {
		logger.interactive.raw('🧠 Loading available Claude Code models...');
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
		logger.interactive.raw(`🎯 Selected Claude Code models: ${modelsToUse.join(', ')}`);
	}
	} // End of if (executionMode === 'direct')

	// Calculate total combinations based on execution mode
	let totalCombinations: number;
	if (executionMode === 'specialist') {
		totalCombinations = suitesToUse.length * scenariosToUse.length * tiersToUse.length * specialistsToUse.length;
	} else {
		totalCombinations = suitesToUse.length * scenariosToUse.length * tiersToUse.length * agentsToUse.length * modelsToUse.length;
	}

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
	logger.interactive.raw(`\n${chalk.green('►')} Will run ${chalk.bold(totalCombinations.toString())} benchmark combination(s)`);
	logger.interactive.raw(`   ${chalk.cyan('Suites:')} ${suitesToUse.join(', ')}`);
	logger.interactive.raw(`   ${chalk.cyan('Scenarios:')} ${scenariosToUse.join(', ')}`);
	logger.interactive.raw(`   ${chalk.cyan('Tiers:')} ${tiersToUse.join(', ')}`);
	if (executionMode === 'specialist') {
		logger.interactive.raw(`   ${chalk.cyan('Specialists:')} ${specialistsToUse.join(', ')}`);
	} else {
		logger.interactive.raw(`   ${chalk.cyan('Agents:')} ${agentsToUse.join(', ')}`);
		if (modelsToUse.length > 0 && modelsToUse[0]) {
			logger.interactive.raw(`   ${chalk.cyan('Models:')} ${modelsToUse.join(', ')}`);
		}
	}
	logger.interactive.raw(`   ${chalk.cyan('Parallel execution:')} ${useParallel ? `Yes (concurrency: ${concurrency})` : 'No'}`);

	// Ask about template enrichment (only for specialist mode)
	let enrichTemplate: string | undefined = undefined;
	if (executionMode === 'specialist' && specialistsToUse.length > 0) {
		const shouldEnrich = await select({
			message: 'Enrich template after benchmarks complete?',
			options: [
				{ value: 'no', label: 'No', hint: 'Skip template enrichment' },
				{ value: 'yes', label: 'Yes', hint: 'Enrich template with LLM-generated metadata' }
			]
		}) as string;

		if (isCancel(shouldEnrich)) {
			cancel('Operation cancelled.');
			return;
		}

		if (shouldEnrich === 'yes') {
			// If only one specialist selected, use it automatically
			if (specialistsToUse.length === 1) {
				enrichTemplate = specialistsToUse[0];
				logger.interactive.raw(`🎯 Will enrich template: ${enrichTemplate}`);
			} else {
				// Multiple specialists - ask which one to enrich
				const specialistOptions = await getAvailableSpecialists();
				const availableSpecialists = specialistOptions.filter(s => 
					specialistsToUse.includes(s.value)
				);

				const selectedEnrichSpecialist = await select({
					message: 'Which specialist template to enrich?',
					options: availableSpecialists.map(s => ({
						value: s.value,
						label: s.label,
						hint: s.description
					}))
				}) as string;

				if (isCancel(selectedEnrichSpecialist)) {
					cancel('Operation cancelled.');
					return;
				}

				enrichTemplate = selectedEnrichSpecialist;
				logger.interactive.raw(`🎯 Will enrich template: ${enrichTemplate}`);
			}
		}
	}

	// Show title before execution
	logger.interactive.info(createTitle());

	// Execute based on mode
	if (executionMode === 'specialist') {
		await executeMultipleBenchmarksWithSpecialists(
			suitesToUse,
			scenariosToUse,
			tiersToUse,
			specialistsToUse,
			enrichTemplate
		);
	} else {
		await executeMultipleBenchmarks(
			suitesToUse,
			scenariosToUse,
			tiersToUse,
			agentsToUse,
			modelsToUse
		);
	}
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

async function getAvailableSpecialists(): Promise<Array<{
  value: string,
  label: string,
  description?: string
}>> {
  const specialists: Array<{value: string, label: string, description?: string}> = [];

  // Load specialists from templates directory
  const root = findRepoRoot();
  const templatesPath = join(root, 'templates');

  if (!existsSync(templatesPath)) {
    return specialists;
  }

  // Read all JSON5/JSONC files in templates directory
  const files = readdirSync(templatesPath).filter(file =>
    (file.endsWith('.json5') || file.endsWith('.jsonc')) && file.includes('specialist')
  );

  for (const file of files) {
    const filePath = join(templatesPath, file);

    try {
      const content = readFileSync(filePath, 'utf8');
      const template = JSON5.parse(content);

      // Extract specialist info from template
      // Use template.name if available, otherwise extract from filename
      // Filename format: "nextjs-specialist-template.json5" or ".jsonc" -> "nextjs-specialist"
      let name = template.name;
      if (!name) {
        // Remove "-template.json5" or "-template.jsonc" suffix if present
        name = file.replace(/-specialist-template\.(json5|jsonc)$/, '-specialist');
        // If still doesn't end with "-specialist", add it
        if (!name.endsWith('-specialist')) {
          name = name.replace(/-template\.(json5|jsonc)$/, '') + '-specialist';
        }
      }
      const displayName = template.displayName || name;
      const purpose = template.persona?.purpose || 'Specialist template';

      specialists.push({
        value: name,
        label: `${displayName} ${chalk.gray(`(${name})`)}`,
        description: purpose
      });
    } catch (e) {
      // Skip invalid JSON5 files
      logger.interactive.warn(`⚠️  Failed to parse ${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return specialists;
}
