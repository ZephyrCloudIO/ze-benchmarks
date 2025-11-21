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
import { logger } from '@ze/logger';

// Get workspace root for specialist template resolution
const workspaceRoot = findWorkspaceRoot(process.cwd());

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
	skipWarmup?: boolean,
	llmJudgeOnly: boolean = true
) {
	// Initialize logger
	const benchmarkLogger = BenchmarkLogger.getInstance();

	// Determine the agent name to log (will be updated if specialist is used)
	// Use 'auto-detect' as placeholder if agent is undefined and specialist is provided
	let agentName = agent || (specialist ? 'auto-detect' : 'echo');
	const agentDisplay = agent || 'auto-detect'; // For display purposes throughout the function
	const runId = await benchmarkLogger.startRun(suite, scenario, tier, agentName, model, batchId);
	const startTime = Date.now();
	
	// Store run data locally to avoid race conditions in parallel execution
	// We'll collect telemetry and evaluations locally and pass them to completeRun
	const runData = {
		runId,
		batchId,
		suite,
		scenario,
		tier,
		agent: agentName,
		model,
		startedAt: new Date().toISOString(),
	};
	const telemetryData: any = {
		toolCalls: 0,
		tokensIn: 0,
		tokensOut: 0,
		costUsd: 0,
		durationMs: 0,
		workspaceDir: undefined as string | undefined,
		promptSent: undefined as string | undefined,
	};
	const evaluationsData: any[] = [];

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
				benchmarkLogger.markRunIncomplete(`Run exceeded timeout (${scenarioTimeoutMin} minutes)`, 'timeout');
				if (!quiet) logger.execution.warn(`⚠ Run timed out after ${scenarioTimeoutMin} minutes`);
			} catch {}
		}, timeoutMs);

		if (progress) updateProgress(progress, 1, 'Loading prompt');
	let promptContent = loadPrompt(suite, scenario, tier);
	
	// Inject artifact information into prompt if this is an artifact scenario
	if (promptContent && scenarioCfg.artifact?.type === 'figma' && scenarioCfg.artifact.figma_file_id) {
		const fileId = scenarioCfg.artifact.figma_file_id;
		const nodeId = scenarioCfg.artifact.figma_file_key; // Could be node ID if provided
		
		// Add artifact context to the prompt
		const artifactContext = `\n\n## Artifact Information\n\n**Figma File ID**: ${fileId}${nodeId ? `\n**Node ID**: ${nodeId}` : ''}\n\nUse the \`figma_get_file\` MCP tool with file_id: "${fileId}"${nodeId ? ` and node_ids: "${nodeId}"` : ''} to fetch the design file.\n`;
		promptContent = promptContent + artifactContext;
		
		if (!quiet) {
			logger.execution.raw(chalk.blue(`[Benchmark] Injected Figma file ID into prompt: ${fileId}`));
		}
	}

		// Early failure check: prompt missing for non-echo agents
		if (!promptContent && agent !== 'echo' && agent !== undefined) {
			benchmarkLogger.failRun('Prompt file not found', 'prompt');
			if (!quiet) logger.execution.error('✗ Prompt file not found');
			if (quiet) logger.execution.error(`[X] ${suite}/${scenario} (${tier}) ${agentDisplay}${model ? ` [${model}]` : ''} - FAILED: Prompt file not found`);
			return;
		}

	// Stage 1.5: Warmup (if configured and not skipped)
	if (!skipWarmup) {
		if (progress) updateProgress(progress, 1, 'Running warmup phase');
		if (!quiet) {
			logger.execution.info('[Benchmark] Running warmup phase...');
		}
		const warmupResult = await executeWarmup(suite, scenario, scenarioCfg, createAgentAdapter, quiet);
		if (!warmupResult.success) {
			benchmarkLogger.failRun(`Warmup failed: ${warmupResult.error}`, 'warmup');
			if (!quiet) {
				logger.execution.error(`[Benchmark] ✗ Warmup failed: ${warmupResult.error}`);
				if (warmupResult.agentError) {
					logger.execution.error(`[Benchmark] Agent error: ${warmupResult.agentError}`);
				}
			}
			if (quiet) logger.execution.error(`[X] ${suite}/${scenario} (${tier}) ${agentDisplay}${model ? ` [${model}]` : ''} - FAILED: Warmup failed`);
			return;
		}
		if (!quiet) {
			logger.execution.success('[Benchmark] ✓ Warmup completed successfully');
		}
	} else {
		if (!quiet) {
			logger.execution.warn('[Benchmark] Skipping warmup (--skip-warmup flag set)');
			logger.execution.debug('[Benchmark] Note: Not validating control folder structure - it varies by scenario');
		}
	}

	// Stage 2: Workspace (optional for artifact-based scenarios)
		if (progress) updateProgress(progress, 2, 'Preparing workspace');
	
	// Check if this is an artifact-based scenario
	const isArtifactScenario = !!scenarioCfg.artifact?.type;
	const workspaceRequired = scenarioCfg.workspace?.required !== false; // Default to true for backward compatibility
	
	let workspaceDir: string | undefined;
	let fixtureDir: string | undefined;
	
	if (!isArtifactScenario && workspaceRequired) {
		const workspacePrep = prepareWorkspaceFromFixture(suite, scenario, getScenarioDir);

		// Early failure check: workspace preparation failed (only fail if workspace is required)
		if (!workspacePrep) {
			benchmarkLogger.failRun('Workspace preparation failed', 'workspace');
			if (!quiet) logger.execution.error('✗ Workspace preparation failed');
			if (quiet) logger.execution.error(`[X] ${suite}/${scenario} (${tier}) ${agentDisplay}${model ? ` [${model}]` : ''} - FAILED: Workspace preparation failed`);
			return;
		}

		workspaceDir = workspacePrep.workspaceDir;
		fixtureDir = workspacePrep.fixtureDir;

		logger.execution.debug(chalk.magenta('🔍 DEBUG: Workspace prepared successfully``'));
		logger.execution.debug(chalk.magenta(`🔍 DEBUG: workspaceDir = ${workspaceDir}`));
		logger.execution.debug(chalk.magenta(`🔍 DEBUG: fixtureDir = ${fixtureDir}`));
	} else if (isArtifactScenario) {
		if (!quiet) {
			logger.execution.debug(chalk.blue('[Benchmark] Artifact-based scenario detected - skipping workspace preparation'));
			logger.execution.debug(chalk.gray(`  Artifact type: ${scenarioCfg.artifact.type}`));
		}
	} else {
		if (!quiet) {
			logger.execution.debug(chalk.yellow('[Benchmark] Workspace not required for this scenario - skipping workspace preparation'));
		}
	}

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
	logger.execution.debug(chalk.magenta('🔍 DEBUG: Stage 3 check - promptContent exists:', !!promptContent, 'agent:', agentDisplay));
	// Allow agent execution if:
	// 1. We have prompt content
	// 2. Agent is not 'echo'
	// 3. Either agent is defined OR specialist is provided (specialist will auto-detect agent via createAgentAdapter)
	if (promptContent && agent !== 'echo' && (agent !== undefined || specialist)) {
		logger.execution.debug(chalk.magenta('🔍 DEBUG: Entering Stage 3 - Agent Execution'));
		if (progress) updateProgress(progress, 3, 'Agent working...');
		try {
			logger.execution.debug(chalk.magenta('🔍 DEBUG: About to create agent adapter'));
			// Create agent adapter (agent can be undefined if specialist will auto-detect)
		const agentAdapter = await createAgentAdapter(agent, model, specialist, workspaceRoot);

			// Update the logged agent name with the actual adapter name
			// (for specialists, this will be "specialist:template-name:base-adapter")
			agentName = agentAdapter.name; // Update local runData too
			runData.agent = agentName; // Update for completeRun
			benchmarkLogger.updateAgent(agentAdapter.name, runId);

			// Show selected model info - ALWAYS for OpenRouter
			if ((agent === 'openrouter' || (!agent && specialist)) && 'getModel' in agentAdapter) {
				const adapterModel = (agentAdapter as any).getModel();
				const modelSource = 'getModelSource' in agentAdapter
					? (agentAdapter as any).getModelSource()
					: 'unknown';

				if (modelSource === 'default') {
					logger.execution.warn(`  ⚠️  Using default model: ${chalk.cyan(adapterModel)}`);
					logger.execution.debug(`     Tip: Search and select a model in interactive mode or use --model flag`);
				} else if (modelSource === 'environment') {
					logger.execution.info(`  ℹ️  Using model from environment: ${chalk.cyan(adapterModel)}`);
				} else if (model && modelSource === 'parameter') {
					logger.execution.debug(`  📋 Using model: ${chalk.cyan(model)}`);

					// Verify match
					if (adapterModel !== model) {
						logger.execution.warn(`  ⚠️  Warning: Model mismatch - requested: ${model}, adapter: ${adapterModel}`);
					} else {
						logger.execution.success(`  ✅ Model confirmed: ${adapterModel}`);
					}
				} else {
					logger.execution.debug(`  📋 Using model: ${chalk.cyan(adapterModel)}`);
				}
			} else if (model && agent !== 'openrouter' && agent !== undefined) {
				// For non-OpenRouter agents, show model if provided
				logger.execution.debug(`  📋 Using model: ${chalk.cyan(model)}`);
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
			if (supportsTools) {
				const tools: any[] = [];
				const toolHandlers = new Map<string, any>();

				// Add workspace tools if workspace is available
				if (workspaceDir) {
					// Create workspace tool handlers
					const workspaceHandlers = createWorkspaceToolHandlers(workspaceDir);

					// Start with workspace tools
					const workspaceTools = getAllWorkspaceTools();
					tools.push(...workspaceTools);
					workspaceHandlers.forEach((handler, name) => {
						toolHandlers.set(name, handler);
					});

					// Add askUser tool if oracle is available
					if (oracle) {
						tools.push(createAskUserToolDefinition());
						toolHandlers.set('askUser', createAskUserHandler(oracle));
					}
				}

				// Note: For Figma artifacts, we rely on MCP tools (figma_get_file) from the specialist template
				// The old custom fetchFigmaFile tool has been removed in favor of MCP tools

				// Add MCP tools if specialist template defines them
				let mcpClients: Map<string, any> | null = null;
				if (specialist && workspaceRoot) {
					try {
						const { resolveSpecialistTemplatePath } = await import('../domain/agent.ts');
						const templatePath = resolveSpecialistTemplatePath(specialist, workspaceRoot);
						
						// Load template to extract MCP configs
						const { loadTemplate } = await import('../../../agency-prompt-creator/src/loader.js');
						const template = await loadTemplate(templatePath, {
							baseDir: workspaceRoot
						});

						// Extract MCP configs from template
						const mcpDefs = template.dependencies?.mcps || [];
						
						if (mcpDefs.length > 0) {
							if (!quiet) {
								logger.execution.raw(chalk.blue(`[Benchmark] Found ${mcpDefs.length} MCP server(s) in specialist template`));
							}

							const {
								resolveMCPConfig,
								initializeMCPClients,
								loadMCPTools,
								cleanupMCPClients,
							} = await import('../runtime/mcp-tools.ts');

							// Resolve MCP configs
							const mcpConfigs = mcpDefs.map(resolveMCPConfig);

							// Initialize MCP clients
							mcpClients = await initializeMCPClients(mcpConfigs, quiet);

							// Load tools from MCP servers
							const { tools: mcpTools, handlers: mcpHandlers } = await loadMCPTools(mcpClients, quiet);

							// Add MCP tools to the tools array
							tools.push(...mcpTools);
							mcpHandlers.forEach((handler, name) => {
								toolHandlers.set(name, handler);
							});

							if (!quiet) {
								logger.execution.raw(chalk.green(`[Benchmark] Added ${mcpTools.length} MCP tool(s) from ${mcpDefs.length} server(s)`));
							}

							// Store cleanup function for later
							// We'll clean up MCP clients after agent execution completes
							(globalThis as any).__mcpCleanup = async () => {
								if (mcpClients) {
									await cleanupMCPClients(mcpClients);
									mcpClients = null;
								}
							};
						}
					} catch (error) {
						logger.execution.error(chalk.yellow(`[Benchmark] Failed to load MCP tools: ${error instanceof Error ? error.message : String(error)}`));
						// Don't fail the benchmark if MCP loading fails (unless required)
					}
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
				
				// Log tools being sent to agent
				if (!quiet) {
					// Categorize tools for better visibility
					const workspaceToolNames = workspaceDir ? getAllWorkspaceTools().map(t => t.name) : [];
					const mcpToolNames = tools
						.map(t => t.name)
						.filter(name => !workspaceToolNames.includes(name) && name !== 'askUser');
					
					logger.execution.raw(chalk.cyan(`[Benchmark] ========== TOOLS CONFIGURATION ==========`));
					logger.execution.raw(chalk.cyan(`[Benchmark] Total tools: ${tools.length}`));
					logger.execution.raw(chalk.cyan(`[Benchmark] Tool handlers: ${toolHandlers.size}`));
					if (workspaceToolNames.length > 0) {
						logger.execution.raw(chalk.cyan(`[Benchmark] Workspace tools (${workspaceToolNames.length}): ${workspaceToolNames.join(', ')}`));
					}
					if (mcpToolNames.length > 0) {
						logger.execution.raw(chalk.green(`[Benchmark] MCP tools (${mcpToolNames.length}): ${mcpToolNames.join(', ')}`));
					}
					if (oracle) {
						logger.execution.raw(chalk.cyan(`[Benchmark] Oracle tool: askUser`));
					}
					logger.execution.raw(chalk.cyan(`[Benchmark] All tools: ${tools.map(t => t.name).join(', ')}`));
					logger.execution.raw(chalk.cyan(`[Benchmark] =========================================`));
				}
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

			// Debug: Log promptSent details
			logger.execution.debug(chalk.magenta('\n🔍 DEBUG: promptSent Details:'));
			logger.execution.debug(chalk.magenta(`  Size: ${(promptSent.length / 1024).toFixed(2)}KB (${promptSent.length} characters)`));
			logger.execution.debug(chalk.magenta(`  Messages count: ${messagesForLogging.length}`));
			if (messagesForLogging.length > 0) {
				messagesForLogging.forEach((msg, idx) => {
					logger.execution.debug(chalk.magenta(`  Message ${idx + 1}: role=${msg.role}, content_length=${msg.content?.length || 0} chars`));
					if (msg.role === 'system' && msg.content) {
						logger.execution.debug(chalk.magenta(`    System prompt preview (first 200 chars): ${msg.content.substring(0, 200)}...`));
					}
					if (msg.role === 'user' && msg.content) {
						logger.execution.debug(chalk.magenta(`    User prompt preview (first 200 chars): ${msg.content.substring(0, 200)}...`));
					}
				});
			}
			logger.execution.debug(chalk.magenta(`  Full promptSent (first 500 chars): ${promptSent.substring(0, 500)}...`));
			logger.execution.debug(chalk.magenta(`  Full promptSent (last 200 chars): ...${promptSent.substring(Math.max(0, promptSent.length - 200))}`));
			logger.execution.debug(chalk.magenta('🔍 END DEBUG: promptSent\n'));

			// Show summary after agent completes
			logger.execution.debug(`  ✓ Tokens: ${response.tokensIn || 0} in, ${response.tokensOut || 0} out | Cost: $${(response.costUsd || 0).toFixed(4)}`);

			// Update result with agent response
			result.agent_response = response.content;
			result.telemetry.tokens.in = response.tokensIn || 0;
			result.telemetry.tokens.out = response.tokensOut || 0;
			result.telemetry.cost_usd = response.costUsd || 0;
			result.telemetry.toolCalls = response.toolCalls ?? 0;

			// Store telemetry locally (for parallel execution safety)
			const duration = Date.now() - startTime;
			telemetryData.toolCalls = response.toolCalls ?? 0;
			telemetryData.tokensIn = response.tokensIn || 0;
			telemetryData.tokensOut = response.tokensOut || 0;
			telemetryData.costUsd = response.costUsd || 0;
			telemetryData.durationMs = duration;
			telemetryData.workspaceDir = workspaceDir;
			telemetryData.promptSent = promptSent;

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
			logger.execution.debug(chalk.magenta('🔍 DEBUG: Agent execution threw error:', JSON.stringify(error, null, 2)));
			benchmarkLogger.failRun(error instanceof Error ? error.message : String(error), 'agent');
			if (!quiet) logger.execution.error('✗ Agent execution failed');
			if (quiet) logger.execution.error(`[X] ${suite}/${scenario} (${tier}) ${agentDisplay}${model ? ` [${model}]` : ''} - FAILED: ${error instanceof Error ? error.message : String(error)}`);
			return; // Early exit - don't continue to evaluation
		}
	} else if (!promptContent) {
		logger.execution.debug(chalk.magenta('🔍 DEBUG: Skipping agent execution - no prompt content'));
	} else if (agent === 'echo' || (agent === undefined && !specialist)) {
		logger.execution.debug(chalk.magenta('🔍 DEBUG: Skipping agent execution - using echo agent or no specialist provided'));
	} else {
		logger.execution.debug(chalk.magenta('🔍 DEBUG: Skipping agent execution - unknown condition'));
	}

	// Stage 4: Validation (skip for artifact scenarios or if validation not required)
	logger.execution.debug(chalk.magenta('🔍 DEBUG: Stage 4 - Validation starting'));
	const validationRequired = scenarioCfg.validation?.required !== false; // Default to true for backward compatibility
	const shouldRunValidation = !isArtifactScenario && workspaceDir && validationRequired;
	
	if (progress) updateProgress(progress, 4, shouldRunValidation ? 'Running validation commands' : 'Skipping validation');
	const commandLog = shouldRunValidation && workspaceDir ? runValidationCommands(workspaceDir, scenarioCfg.validation?.commands) : [];
	const diffArtifacts = workspaceDir && fixtureDir ? buildDiffArtifacts(fixtureDir, workspaceDir) : { diffSummary: [], depsDelta: [] };
	
	if (!shouldRunValidation && !quiet) {
		if (isArtifactScenario) {
			logger.execution.raw(chalk.blue('[Benchmark] Skipping validation commands (artifact-based scenario)'));
		} else if (!validationRequired) {
			logger.execution.raw(chalk.blue('[Benchmark] Skipping validation commands (validation.required: false)'));
		}
	}

	const passedCommands = commandLog.filter(cmd => cmd.exitCode === 0).length;
	if (!quiet) logger.execution.debug(`  ✓ ${passedCommands}/${commandLog.length} commands passed`);

	// Stage 5: Evaluation
	logger.execution.debug(chalk.magenta('🔍 DEBUG: Stage 5 - Evaluation starting'));
	if (llmJudgeOnly) {
		if (!quiet) logger.execution.info('[Benchmark] Running LLM judge only (other evaluators skipped)');
	}
	if (progress) updateProgress(progress, 5, llmJudgeOnly ? 'Computing LLM judge scores' : 'Computing scores');

	try {
		// Load benchmark config to get suitesDir (needed for both workspace and artifact scenarios)
		const { loadBenchmarkConfig } = await import('../lib/config.ts');
		const config = loadBenchmarkConfig();

		// Calculate reference path if scenario has reference_path
		let referencePath: string | undefined;
		if (scenarioCfg.reference_path) {
			const scenarioDir = getScenarioDir(suite, scenario);
			referencePath = join(scenarioDir, scenarioCfg.reference_path);
		}

		// Build evaluation context
		const ctx = {
			scenario: scenarioCfg,
			workspaceDir, // May be undefined for artifact scenarios
			suitesDir: config.suitesDir,
			referencePath,
			agentResponse: result.agent_response,
			commandLog,
			diffSummary: diffArtifacts.diffSummary,
			depsDelta: diffArtifacts.depsDelta,
			...(isArtifactScenario && {
				artifact: {
					type: scenarioCfg.artifact!.type,
					// Artifact data could be fetched here if needed, or left for evaluators to fetch
				}
			}),
		};

		// For artifact scenarios, force LLM judge only (code-based evaluators don't apply)
		const shouldUseLLMJudgeOnly = isArtifactScenario || llmJudgeOnly;
		if (isArtifactScenario && !llmJudgeOnly && !quiet) {
			logger.execution.raw(chalk.blue('[Benchmark] Artifact scenario detected - using LLM judge only'));
		}

		const { scoreCard, results: evaluatorResults } = await runEvaluators(ctx, shouldUseLLMJudgeOnly);
		result.scores = { ...result.scores, ...scoreCard };
		result.totals = computeWeightedTotals(result.scores, scenarioCfg);
		(result as any).evaluator_results = evaluatorResults;
		(result as any).diff_summary = diffArtifacts.diffSummary;
		(result as any).deps_delta = diffArtifacts.depsDelta;

		// Store evaluation results locally (for parallel execution safety)
		for (const evalResult of evaluatorResults) {
			evaluationsData.push({
				evaluatorName: evalResult.name,
				score: evalResult.score,
				maxScore: 1.0,
				details: evalResult.details,
			});
		}

		// Show evaluator summary
		const avgScore = Object.values(scoreCard).reduce((sum, score) => sum + (score as number), 0) / Object.keys(scoreCard).length;
		if (!quiet) logger.execution.raw(chalk.gray(`  ✓ Average score: ${(avgScore * 100).toFixed(1)}%`));
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

	// Use new signature to avoid race conditions in parallel execution
	// Pass all data directly instead of relying on this.currentRun
	benchmarkLogger.completeRun({
		runId: runData.runId,
		batchId: runData.batchId,
		suite: runData.suite,
		scenario: runData.scenario,
		tier: runData.tier,
		agent: runData.agent,
		model: runData.model,
		status: 'completed',
		startedAt: runData.startedAt,
		completedAt: new Date().toISOString(),
		totalScore,
		weightedScore: result.totals?.weighted,
		isSuccessful,
		successMetric,
		specialistEnabled: !!specialist,
		metadata: {
			diffSummary: diffArtifacts.diffSummary,
			depsDelta: diffArtifacts.depsDelta,
			oracleQuestions: (result as any).oracle_questions,
			...(packageManager && { packageManager }),
			...(testResultsJson && { testResults: testResultsJson }),
		},
		evaluations: evaluationsData,
		telemetry: telemetryData,
	});

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
		logger.execution.raw(`${status} ${suite}/${scenario} (${tier}) ${agentDisplay}${modelStr} - ${weightedScore.toFixed(2)}/10 [${successStr}]`);
		
		// Still show LLM Judge table even in quiet mode (it's important information)
		if (result.scores) {
			displayLLMJudgeScores(result, scenarioCfg);
		}
		return;
	}

	logger.execution.raw(`\n${chalk.bold.underline('Benchmark Results')}`);
	logger.execution.raw(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
	logger.execution.raw(`│ ${chalk.bold('Agent:')} ${chalk.cyan(agentDisplay.padEnd(15))} ${chalk.bold('Tier:')} ${chalk.cyan(tier.padEnd(8))} ${chalk.bold('Duration:')} ${chalk.blue(duration.toFixed(2) + 's')} │`);
	logger.execution.raw(`├${'─'.repeat(TABLE_WIDTH)}┤`);
	logger.execution.raw(`│ ${chalk.bold('Score (mean ± σ):')} ${chalk.green(weightedScore.toFixed(4))} ± ${chalk.green('0.0000')} ${chalk.gray('(out of 10.0)')} │`);
	logger.execution.raw(`│ ${chalk.bold('Range (min ... max):')} ${chalk.green(weightedScore.toFixed(4))} ${chalk.white('...')} ${chalk.red(weightedScore.toFixed(4))} ${chalk.gray('(1 run)')} │`);
	logger.execution.raw(`└${'─'.repeat(TABLE_WIDTH)}┘`);

	// Show detailed LLM Judge scores if available
	if (result.scores) {
		displayLLMJudgeScores(result, scenarioCfg);
	}

	// Print telemetry in table format
	if (result.telemetry) {
		logger.execution.raw(`\n${chalk.bold.underline('Telemetry')}`);
		logger.execution.raw(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
		logger.execution.raw(`│ ${chalk.bold('Metric'.padEnd(20))} ${chalk.bold('Value'.padEnd(20))} ${chalk.bold('Unit'.padEnd(15))} │`);
		logger.execution.raw(`├${'─'.repeat(TABLE_WIDTH)}┤`);
		logger.execution.raw(`│ ${chalk.cyan('Tool Calls'.padEnd(20))} ${chalk.green((result.telemetry.toolCalls || 0).toString().padEnd(20))} ${chalk.gray('calls'.padEnd(15))} │`);
		logger.execution.raw(`│ ${chalk.cyan('Tokens In'.padEnd(20))} ${chalk.green((result.telemetry.tokens?.in || 0).toString().padEnd(20))} ${chalk.gray('tokens'.padEnd(15))} │`);
		logger.execution.raw(`│ ${chalk.cyan('Tokens Out'.padEnd(20))} ${chalk.green((result.telemetry.tokens?.out || 0).toString().padEnd(20))} ${chalk.gray('tokens'.padEnd(15))} │`);
		logger.execution.raw(`│ ${chalk.cyan('Cost'.padEnd(20))} ${chalk.green(`$${(result.telemetry.cost_usd || 0).toFixed(6)}`.padEnd(20))} ${chalk.gray('USD'.padEnd(15))} │`);
		logger.execution.raw(`└${'─'.repeat(TABLE_WIDTH)}┘`);
	}

	// Show database summary in table format
	try {
		const stats = await benchmarkLogger.getStats();
		logger.execution.raw(`\n${chalk.bold.underline('Database Summary')}`);
		logger.execution.raw(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
		logger.execution.raw(`│ ${chalk.bold('Metric'.padEnd(25))} ${chalk.bold('Value'.padEnd(20))} ${chalk.bold('Status'.padEnd(10))} │`);
		logger.execution.raw(`├${'─'.repeat(TABLE_WIDTH)}┤`);
		logger.execution.raw(`│ ${chalk.cyan('Total Runs'.padEnd(25))} ${chalk.blue((stats.totalRuns || 0).toString().padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		logger.execution.raw(`│ ${chalk.cyan('Success Rate'.padEnd(25))} ${chalk.green(`${((stats.successRate || 0) * 100).toFixed(1)}%`.padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		logger.execution.raw(`│ ${chalk.cyan('Average Score'.padEnd(25))} ${chalk.green((stats.averageWeightedScore || 0).toFixed(4).padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		logger.execution.raw(`│ ${chalk.cyan('API'.padEnd(25))} ${chalk.blue('Cloudflare Worker'.padEnd(20))} ${chalk.green('✓'.padEnd(10))} │`);
		logger.execution.raw(`└${'─'.repeat(TABLE_WIDTH)}┘`);

	} catch (dbError) {
		logger.execution.warn('Database query failed:');
		logger.execution.debug(dbError instanceof Error ? dbError.message : String(dbError));
	}

	// Results are saved to database only (benchmarks.db is the single source of truth)
	logger.execution.raw(`\n${chalk.green('✓')} Results saved to database`);

	// Note: Database is now created directly in public/ directory

	// Show completion outro
	logger.execution.raw(`\n${chalk.green('✓')} Benchmark completed successfully`);

	} catch (error) {
		// Catch-all for unexpected errors
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;

		benchmarkLogger.failRun(errorMessage, 'unknown');

		if (!quiet) {
			logger.execution.error('✗ Unexpected error');
			logger.execution.error('\nError details:');
			logger.execution.error(errorMessage);
			if (errorStack) {
				logger.execution.debug('\nStack trace:');
				logger.execution.debug(errorStack);
			}
		}
		if (quiet) {
			logger.execution.error(`[X] ${suite}/${scenario} (${tier}) ${agentDisplay}${model ? ` [${model}]` : ''} - FAILED: ${errorMessage}`);
		}
	} finally {
		if (progress) completeProgress(progress);
		// Clear timeout watchdog if set
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}

		// Cleanup MCP clients if they were initialized
		if ((globalThis as any).__mcpCleanup) {
			try {
				await (globalThis as any).__mcpCleanup();
				delete (globalThis as any).__mcpCleanup;
			} catch (error) {
				logger.execution.error(chalk.yellow(`[Benchmark] Error cleaning up MCP clients: ${error instanceof Error ? error.message : String(error)}`));
			}
		}
	}
}
