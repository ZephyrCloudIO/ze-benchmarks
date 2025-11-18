/**
 * Core Benchmark Execution Logic
 *
 * This module contains the main benchmark runner function that orchestrates
 * the entire benchmark execution pipeline from setup through evaluation.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import type { AgentRequest } from '../../../agent-adapters/src/index.ts';
import { BenchmarkLogger } from '@ze/worker-client';
import { runEvaluators } from '../../../evaluators/src/index.ts';
import { runValidationCommands } from '../runtime/validation.ts';
import { buildDiffArtifacts } from '../runtime/diff.ts';
import { detectPackageManager, extractPackageManagerFromCommand, extractTestResults } from '../runtime/extractors.ts';
import { Oracle } from '../runtime/oracle.ts';
import { createAskUserToolDefinition, createAskUserHandler } from '../runtime/ask-user-tool.ts';
import { getAllWorkspaceTools, createWorkspaceToolHandlers } from '../runtime/workspace-tools.ts';

// Import helper functions from their respective modules
import { loadScenario, loadPrompt, getScenarioDir } from '../domain/scenario.ts';
import { executeWarmup } from '../domain/warmup.ts';
import { prepareWorkspaceFromFixture, findWorkspaceRoot } from '../lib/workspace-utils.ts';
import { createAgentAdapter } from '../domain/agent.ts';
import { computeWeightedTotals, calculateSuccess } from '../domain/scoring.ts';
import { displayLLMJudgeScores, createProgress, updateProgress, completeProgress } from '../lib/display.ts';
import { TABLE_WIDTH, SCORE_THRESHOLDS } from '../lib/constants.ts';

// Get workspace root for specialist template resolution
const workspaceRoot = findWorkspaceRoot(process.cwd());

// Additional constants (keeping the ones not in constants.ts)
const ADDITIONAL_THRESHOLDS = {
	EXCELLENT: 90,
	GOOD: 70,
	NEEDS_WORK: 60
} as const;

/**
 * Execute a complete benchmark run
 *
 * This is the main orchestration function that runs through all stages:
 * 1. Setup - Load scenario and prompt configuration
 * 2. Warmup - Execute optional warmup phase
 * 3. Workspace - Prepare test workspace from fixture
 * 4. Agent - Execute the AI agent with the prompt
 * 5. Validation - Run validation commands
 * 6. Evaluation - Compute scores using evaluators
 * 7. Results - Display and save results
 *
 * @param suite - The benchmark suite name
 * @param scenario - The scenario name within the suite
 * @param tier - The prompt tier (L0, L1, etc.)
 * @param agent - The agent adapter to use (anthropic, openrouter, etc.)
 * @param model - Optional specific model identifier
 * @param batchId - Optional batch ID for grouping runs
 * @param quiet - Whether to suppress verbose output
 * @param specialist - Optional specialist template to use
 */
export async function executeBenchmark(
	suite: string,
	scenario: string,
	tier: string,
	agent: string | undefined,
	model?: string,
	batchId?: string,
	quiet?: boolean,
	specialist?: string,
	skipWarmup?: boolean
) {
	// Initialize logger
	const logger = BenchmarkLogger.getInstance();

	// Determine the agent name to log (will be updated if specialist is used)
	// Use 'auto-detect' as placeholder if agent is undefined and specialist is provided
	let agentName = agent || (specialist ? 'auto-detect' : 'echo');
	const agentDisplay = agent || 'auto-detect'; // For display purposes throughout the function
	const runId = logger.startRun(suite, scenario, tier, agentName, model, batchId);
	const startTime = Date.now();

	// Timeout watchdog based on scenario timeout_minutes (default 60)
	let timeoutId: NodeJS.Timeout | null = null;

	// Initialize progress tracker (only if not in quiet mode)
	const progress = quiet ? null : createProgress();

	try {
	// Stage 1: Setup
		if (progress) updateProgress(progress, 1, 'Loading scenario configuration');
	const scenarioCfg = loadScenario(suite, scenario);

		// Start timeout watchdog after loading scenario config
		const scenarioTimeoutMin = Number(scenarioCfg.timeout_minutes || 60);
		const timeoutMs = Math.max(1, scenarioTimeoutMin) * 60 * 1000;
		timeoutId = setTimeout(() => {
			try {
				logger.markRunIncomplete(`Run exceeded timeout (${scenarioTimeoutMin} minutes)`, 'timeout');
				if (!quiet) console.log(chalk.yellow(`⚠ Run timed out after ${scenarioTimeoutMin} minutes`));
			} catch {}
		}, timeoutMs);

		if (progress) updateProgress(progress, 1, 'Loading prompt');
	const promptContent = loadPrompt(suite, scenario, tier);

		// Early failure check: prompt missing for non-echo agents
		if (!promptContent && agent !== 'echo' && agent !== undefined) {
			logger.failRun('Prompt file not found', 'prompt');
			if (!quiet) console.log(chalk.red('✗ Prompt file not found'));
			if (quiet) console.log(chalk.red(`[X] ${suite}/${scenario} (${tier}) ${agentDisplay}${model ? ` [${model}]` : ''} - FAILED: Prompt file not found`));
			return;
		}

	// Stage 1.5: Warmup (if configured and not skipped)
	if (!skipWarmup) {
		if (progress) updateProgress(progress, 1, 'Running warmup phase');
		if (!quiet) {
			console.log(chalk.blue('[Benchmark] Running warmup phase...'));
		}
		const warmupResult = await executeWarmup(suite, scenario, scenarioCfg, createAgentAdapter, quiet);
		if (!warmupResult.success) {
			logger.failRun(`Warmup failed: ${warmupResult.error}`, 'warmup');
			if (!quiet) {
				console.log(chalk.red(`[Benchmark] ✗ Warmup failed: ${warmupResult.error}`));
				if (warmupResult.agentError) {
					console.log(chalk.red(`[Benchmark] Agent error: ${warmupResult.agentError}`));
				}
			}
			if (quiet) console.log(chalk.red(`[X] ${suite}/${scenario} (${tier}) ${agentDisplay}${model ? ` [${model}]` : ''} - FAILED: Warmup failed`));
			return;
		}
		if (!quiet) {
			console.log(chalk.green('[Benchmark] ✓ Warmup completed successfully'));
		}
	} else {
		if (!quiet) {
			console.log(chalk.yellow('[Benchmark] Skipping warmup (--skip-warmup flag set)'));
			console.log(chalk.gray('[Benchmark] Note: Not validating control folder structure - it varies by scenario'));
		}
	}

	// Stage 2: Workspace
		if (progress) updateProgress(progress, 2, 'Preparing workspace');
	const workspacePrep = prepareWorkspaceFromFixture(suite, scenario, getScenarioDir);

		// Early failure check: workspace preparation failed
		if (!workspacePrep) {
			logger.failRun('Workspace preparation failed', 'workspace');
			if (!quiet) console.log(chalk.red('✗ Workspace preparation failed'));
			if (quiet) console.log(chalk.red(`[X] ${suite}/${scenario} (${tier}) ${agentDisplay}${model ? ` [${model}]` : ''} - FAILED: Workspace preparation failed`));
			return;
		}

		const workspaceDir = workspacePrep.workspaceDir;
		const fixtureDir = workspacePrep.fixtureDir;

		console.log(chalk.magenta('🔍 DEBUG: Workspace prepared successfully'));
		console.log(chalk.magenta(`🔍 DEBUG: workspaceDir = ${workspaceDir}`));
		console.log(chalk.magenta(`🔍 DEBUG: fixtureDir = ${fixtureDir}`));

	// Initialize result structure
	const result = {
		suite,
		scenario,
		tier,
		agent: agent || 'auto-detect',
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
	console.log(chalk.magenta('🔍 DEBUG: Stage 3 check - promptContent exists:', !!promptContent, 'agent:', agentDisplay));
	if (promptContent && agent !== 'echo' && agent !== undefined) {
		console.log(chalk.magenta('🔍 DEBUG: Entering Stage 3 - Agent Execution'));
		if (progress) updateProgress(progress, 3, 'Agent working...');
		try {
			console.log(chalk.magenta('🔍 DEBUG: About to create agent adapter'));
			// Create agent adapter (agent can be undefined if specialist will auto-detect)
		const agentAdapter = await createAgentAdapter(agent, model, specialist, workspaceRoot);

			// Update the logged agent name with the actual adapter name
			// (for specialists, this will be "specialist:template-name:base-adapter")
			logger.updateAgent(agentAdapter.name, runId);

			// Show selected model info - ALWAYS for OpenRouter
			if ((agent === 'openrouter' || (!agent && specialist)) && 'getModel' in agentAdapter) {
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
			} else if (model && agent !== 'openrouter' && agent !== undefined) {
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

			// Build the request messages
			// For vanilla runs: send ONLY user message (no system prompt for true baseline testing)
			// For specialist runs: SpecialistAdapter will add the specialist system prompt from template
			const messages: Array<{ role: 'system' | 'user'; content: string }> = [
				{
					role: 'user' as const,
					content: promptContent
				}
			];

			// Build the request
			const request: AgentRequest = {
				messages,
				...(workspaceDir && { workspaceDir }),
			};

			// Add tools if agent supports them (Anthropic and OpenRouter)
			// Also support when agent is undefined but specialist will auto-detect (will be determined in createAgentAdapter)
			const supportsTools = agent === 'anthropic' || agent === 'openrouter' || (!agent && specialist);
			if (supportsTools && workspaceDir) {
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
				// If agent is undefined, we'll determine format after adapter is created
				// For now, default to OpenRouter format when agent is undefined
				if (agent === 'openrouter' || (!agent && specialist)) {
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

			// Extract the prompt being sent for logging
			// For specialist adapters, get the transformed messages (with system prompt)
			// For vanilla adapters, use the original request messages
			let messagesForLogging = request.messages;
			if ('getLastTransformedMessages' in agentAdapter) {
				const transformed = (agentAdapter as any).getLastTransformedMessages();
				if (transformed) {
					messagesForLogging = transformed;
				}
			}
			const promptSent = JSON.stringify(messagesForLogging);

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
				workspaceDir,
				promptSent
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
			console.log(chalk.magenta('🔍 DEBUG: Agent execution threw error:', error));
			logger.failRun(error instanceof Error ? error.message : String(error), 'agent');
			if (!quiet) console.log(chalk.red('✗ Agent execution failed'));
			if (quiet) console.log(chalk.red(`[X] ${suite}/${scenario} (${tier}) ${agentDisplay}${model ? ` [${model}]` : ''} - FAILED: ${error instanceof Error ? error.message : String(error)}`));
			return; // Early exit - don't continue to evaluation
		}
	} else if (!promptContent) {
		console.log(chalk.magenta('🔍 DEBUG: Skipping agent execution - no prompt content'));
	} else if (agent === 'echo' || agent === undefined) {
		console.log(chalk.magenta('🔍 DEBUG: Skipping agent execution - using echo agent or auto-detect'));
	}

	// Stage 4: Validation
	console.log(chalk.magenta('🔍 DEBUG: Stage 4 - Validation starting'));
	if (progress) updateProgress(progress, 4, 'Running validation commands');
	const commandLog = workspaceDir ? runValidationCommands(workspaceDir, scenarioCfg.validation?.commands) : [];
	const diffArtifacts = workspaceDir && fixtureDir ? buildDiffArtifacts(fixtureDir, workspaceDir) : { diffSummary: [], depsDelta: [] };

	const passedCommands = commandLog.filter(cmd => cmd.exitCode === 0).length;
	if (!quiet) console.log(chalk.gray(`  ✓ ${passedCommands}/${commandLog.length} commands passed`));

	// Stage 5: Evaluation
	console.log(chalk.magenta('🔍 DEBUG: Stage 5 - Evaluation starting'));
	if (progress) updateProgress(progress, 5, 'Computing scores');

	try {
		if (workspaceDir) {
			// Load benchmark config to get suitesDir
			const { loadBenchmarkConfig } = await import('../lib/config.ts');
			const config = loadBenchmarkConfig();

			// Calculate reference path if scenario has reference_path
			let referencePath: string | undefined;
			if (scenarioCfg.reference_path) {
				const scenarioDir = getScenarioDir(suite, scenario);
				referencePath = join(scenarioDir, scenarioCfg.reference_path);
			}

			// Actually run evaluators
			const ctx = {
				scenario: scenarioCfg,
				workspaceDir,
				suitesDir: config.suitesDir,
				referencePath,
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

	// Calculate success based on validation commands and evaluator scores
	const { isSuccessful, successMetric } = calculateSuccess(commandLog, result.scores || {}, scenarioCfg);

	// Extract package manager and test results
	let packageManager: string | undefined;
	if (workspaceDir) {
		packageManager = detectPackageManager(workspaceDir);
		if (packageManager === 'unknown') {
			packageManager = extractPackageManagerFromCommand(commandLog);
		}
	}

	const testResults = extractTestResults(commandLog);
	const testResultsJson = testResults ? JSON.stringify(testResults) : undefined;

	logger.completeRun(
		totalScore,
		result.totals?.weighted,
		{
			diffSummary: diffArtifacts.diffSummary,
			depsDelta: diffArtifacts.depsDelta,
			oracleQuestions: (result as any).oracle_questions
		},
		isSuccessful,
		successMetric,
		packageManager,
		testResultsJson
	);

	// Stage 6: Results
	if (progress) updateProgress(progress, 6, 'Preparing results');

	if (progress) completeProgress(progress);

	// Display results in table format (only if not in quiet mode)
	const duration = (Date.now() - startTime) / 1000;
	const weightedScore = result.totals?.weighted || 0;

	// In quiet mode, show compact one-line output
	if (quiet) {
		const status = isSuccessful ? chalk.green('✓') : chalk.red('✗');
		const modelStr = model ? ` [${model}]` : '';
		const successStr = isSuccessful ? 'SUCCESS' : 'FAILED';
		console.log(`${status} ${suite}/${scenario} (${tier}) ${agentDisplay}${modelStr} - ${weightedScore.toFixed(2)}/10 [${successStr}]`);
		return;
	}

	console.log(`\n${chalk.bold.underline('Benchmark Results')}`);
	console.log(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
	console.log(`│ ${chalk.bold('Agent:')} ${chalk.cyan(agentDisplay.padEnd(15))} ${chalk.bold('Tier:')} ${chalk.cyan(tier.padEnd(8))} ${chalk.bold('Duration:')} ${chalk.blue(duration.toFixed(2) + 's')} │`);
	console.log(`├${'─'.repeat(TABLE_WIDTH)}┤`);
	console.log(`│ ${chalk.bold('Score (mean ± σ):')} ${chalk.green(weightedScore.toFixed(4))} ± ${chalk.green('0.0000')} ${chalk.gray('(out of 10.0)')} │`);
	console.log(`│ ${chalk.bold('Range (min ... max):')} ${chalk.green(weightedScore.toFixed(4))} ${chalk.white('...')} ${chalk.red(weightedScore.toFixed(4))} ${chalk.gray('(1 run)')} │`);
	console.log(`└${'─'.repeat(TABLE_WIDTH)}┘`);

	// Print evaluation breakdown in table format
	if (result.scores) {
		console.log(`\n${chalk.bold.underline('Evaluation Breakdown')}`);
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
		console.log(`\n${chalk.bold.underline('Telemetry')}`);
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
		const stats = await logger.getStats();
		console.log(`\n${chalk.bold.underline('Database Summary')}`);
		console.log(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
		console.log(`│ ${chalk.bold('Metric'.padEnd(25))} ${chalk.bold('Value'.padEnd(20))} ${chalk.bold('Status'.padEnd(10))} │`);
		console.log(`├${'─'.repeat(TABLE_WIDTH)}┤`);
		console.log(`│ ${chalk.cyan('Total Runs'.padEnd(25))} ${chalk.blue((stats.totalRuns || 0).toString().padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log(`│ ${chalk.cyan('Success Rate'.padEnd(25))} ${chalk.green(`${((stats.successRate || 0) * 100).toFixed(1)}%`.padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log(`│ ${chalk.cyan('Average Score'.padEnd(25))} ${chalk.green((stats.averageWeightedScore || 0).toFixed(4).padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log(`│ ${chalk.cyan('API'.padEnd(25))} ${chalk.blue('Cloudflare Worker'.padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		console.log(`└${'─'.repeat(TABLE_WIDTH)}┘`);

	} catch (dbError) {
		console.log(chalk.yellow('Database query failed:'));
		console.error(chalk.dim(dbError instanceof Error ? dbError.message : String(dbError)));
	}

	// Results are saved to database only (benchmarks.db is the single source of truth)
	console.log(`\n${chalk.green('✓')} Results saved to database`);

	// Note: Database is now created directly in public/ directory

	// Show completion outro
	console.log(`\n${chalk.green('✓')} Benchmark completed successfully`);

	} catch (error) {
		// Catch-all for unexpected errors
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;

		logger.failRun(errorMessage, 'unknown');

		if (!quiet) {
			console.log(chalk.red('✗ Unexpected error'));
			console.error(chalk.red('\nError details:'));
			console.error(chalk.red(errorMessage));
			if (errorStack) {
				console.error(chalk.dim('\nStack trace:'));
				console.error(chalk.dim(errorStack));
			}
		}
		if (quiet) {
			console.log(chalk.red(`[X] ${suite}/${scenario} (${tier}) ${agentDisplay}${model ? ` [${model}]` : ''} - FAILED: ${errorMessage}`));
		}
	} finally {
		if (progress) completeProgress(progress);
		// Clear timeout watchdog if set
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	}
}
