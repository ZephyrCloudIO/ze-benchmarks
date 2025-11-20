import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { EchoAgent, ClaudeCodeAdapter, OpenRouterAdapter, AnthropicAdapter, type AgentAdapter } from '../../../agent-adapters/src/index.ts';
// Import types from agency-prompt-creator (using relative path since it's a workspace package)
import type { SpecialistTemplate, PreferredModel } from '../../../agency-prompt-creator/src/types.ts';
import { logger } from '@ze/logger';
import type { OpenRouterModel } from '../lib/openrouter-api.js';

// ============================================================================
// AGENT MANAGEMENT
// ============================================================================

export async function getAvailableAgents(): Promise<Array<{value: string, label: string}>> {
  const agents = [
    { value: '__ALL__', label: 'All agents' },
    { value: 'echo', label: 'Echo (Test Agent)' },
    { value: 'openrouter', label: 'OpenRouter (Any Model)' },
    { value: 'anthropic', label: 'Anthropic Claude (Direct API)' },
    { value: 'claude-code', label: 'Claude Code' }
  ];

  return agents;
}


/**
 * Select preferred model from template
 * 
 * Returns the first preferred model from the template's preferred_models array.
 * Future enhancement: use weight if available to select highest weight model.
 * 
 * @param template - Specialist template with preferred_models
 * @returns Preferred model or undefined if none found
 */
export function selectPreferredModel(template: SpecialistTemplate): PreferredModel | undefined {
	if (!template.preferred_models || template.preferred_models.length === 0) {
		return undefined;
	}
	
	// For now, return first model. Future: sort by weight if available
	// TODO: If weights are provided, select model with highest weight
	return template.preferred_models[0];
}

/**
 * Find closest matching OpenRouter model using the same search logic as CLI
 * 
 * Uses the same searchModels logic from OpenRouterAPI to find matches, then
 * selects the best match based on relevance scoring.
 * 
 * @param preferredModelName - Model name from template (e.g., "claude-sonnet-4.5")
 * @param availableModels - List of available OpenRouter models
 * @param openrouterAPI - OpenRouterAPI instance for searching
 * @returns Closest matching model ID or the original name if no match found
 */
export function findClosestOpenRouterModel(
	preferredModelName: string,
	availableModels: OpenRouterModel[],
	openrouterAPI: { searchModels: (models: OpenRouterModel[], searchTerm: string) => OpenRouterModel[] }
): string {
	// Search using the same method as interactive CLI
	const searchResults = openrouterAPI.searchModels(availableModels, preferredModelName);
	
	if (searchResults.length === 0) {
		// No matches found, return original
		return preferredModelName;
	}
	
	// Score matches by relevance (same logic as CLI would use)
	const normalized = preferredModelName.toLowerCase();
	
	// Find best match by scoring:
	// 1. Exact ID match (highest priority)
	// 2. ID contains the search term
	// 3. Name contains the search term
	// 4. Description contains the search term
	
	const scoredMatches = searchResults.map((model: OpenRouterModel) => {
		let score = 0;
		const modelId = model.id.toLowerCase();
		const modelName = model.name?.toLowerCase() || '';
		const modelDesc = model.description?.toLowerCase() || '';
		
		// Exact ID match
		if (modelId === normalized || modelId === `anthropic/${normalized}` || modelId === `openai/${normalized}`) {
			score += 100;
		}
		
		// ID starts with search term
		if (modelId.startsWith(normalized) || modelId.startsWith(`anthropic/${normalized}`) || modelId.startsWith(`openai/${normalized}`)) {
			score += 50;
		}
		
		// ID contains search term
		if (modelId.includes(normalized)) {
			score += 30;
		}
		
		// Model ID ends with search term (e.g., "claude-sonnet-4.5" matches "anthropic/claude-sonnet-4.5")
		const modelIdSuffix = modelId.split('/').pop() || '';
		if (modelIdSuffix === normalized || normalized.includes(modelIdSuffix)) {
			score += 40;
		}
		
		// Name matches
		if (modelName === normalized) {
			score += 20;
		} else if (modelName.includes(normalized)) {
			score += 10;
		}
		
		// Description contains search term (lowest priority)
		if (modelDesc.includes(normalized)) {
			score += 5;
		}
		
		return { model, score };
	});
	
	// Sort by score (highest first) and return the best match
	scoredMatches.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
	
	const bestMatch = scoredMatches[0];
	
	// Only return if score is meaningful (at least 10 points)
	if (bestMatch.score >= 10) {
		return bestMatch.model.id;
	}
	
	// If no good match, return first search result (CLI would show these)
	return searchResults[0].id;
}

/**
 * Resolve specialist name to template file path
 *
 * Converts a specialist name (e.g., @zephyr-cloud/shadcn-specialist) to the
 * corresponding template file path in starting_from_outcome/
 *
 * @param specialistName - Specialist name (with or without namespace)
 * @param workspaceRoot - Workspace root directory
 * @returns Absolute path to template file
 * @throws Error if template file doesn't exist
 */
export function resolveSpecialistTemplatePath(specialistName: string, workspaceRoot: string): string {
	// Strip namespace prefix if present (e.g., @zephyr-cloud/)
	const templateName = specialistName.replace(/^@[^/]+\//, '');

	// Try both .jsonc and .json5 extensions (prefer .jsonc)
	const extensions = ['.jsonc', '.json5'];
	for (const ext of extensions) {
		const templatePath = `templates/${templateName}-template${ext}`;
		const absolutePath = resolve(workspaceRoot, templatePath);
		
		if (existsSync(absolutePath)) {
			return absolutePath;
		}
	}

	// If neither exists, throw error with both paths
	const jsoncPath = resolve(workspaceRoot, `templates/${templateName}-template.jsonc`);
	const json5Path = resolve(workspaceRoot, `templates/${templateName}-template.json5`);
	throw new Error(
		`Specialist template not found: ${specialistName}\n` +
		`  Tried: ${jsoncPath}\n` +
		`  Tried: ${json5Path}\n` +
		`  Tip: Ensure the template file exists in templates/`
	);
}

export async function createAgentAdapter(agentName?: string, model?: string, specialistName?: string, workspaceRoot?: string): Promise<AgentAdapter> {
	// Log agent creation attempt
	logger.agent.debug('[DEBUG] createAgentAdapter()');
	logger.agent.debug(`  Agent: ${agentName || 'auto-detect'}`);
	logger.agent.debug(`  Model: ${model || 'auto-detect'}`);
	logger.agent.debug(`  Specialist: ${specialistName || 'none'}`);
	logger.agent.debug(`  Workspace root: ${workspaceRoot || 'none'}`);

	// If specialist is provided but model/agent not specified, try to auto-detect from template
	let finalAgentName = agentName;
	let finalModel = model;

	if (specialistName && workspaceRoot && (!model || !agentName)) {
		try {
			logger.agent.debug(`  Auto-detecting model and agent from specialist template...`);
			const templatePath = resolveSpecialistTemplatePath(specialistName, workspaceRoot);
			
			// Load template to get preferred models
			const { loadTemplate } = await import('../../../agency-prompt-creator/src/loader.js');
			const template = await loadTemplate(templatePath, {
				baseDir: workspaceRoot
			});

			// Select preferred model if model not provided
			if (!model) {
				const preferredModel = selectPreferredModel(template);
				if (preferredModel) {
					finalModel = preferredModel.model;
					logger.agent.info(`  ℹ️  Using preferred model from template: ${chalk.cyan(finalModel)}`);
				} else {
					logger.agent.warn(`  ⚠️  No preferred models found in template, using default agent`);
				}
			}

			// If agent not provided, default to openrouter (we'll find the model in OpenRouter's catalog)
			if (!agentName) {
				finalAgentName = 'openrouter';
				logger.agent.info(`  ℹ️  Auto-detected agent: ${chalk.cyan('openrouter')} (will find model in OpenRouter catalog)`);
			}

			// Find the OpenRouter model by name using the same search logic as the interactive CLI
			if (finalAgentName === 'openrouter' && finalModel) {
				try {
					const { OpenRouterAPI } = await import('../lib/openrouter-api.js');
					const openrouterAPI = new OpenRouterAPI(process.env.OPENROUTER_API_KEY || '');
					const availableModels = await openrouterAPI.getModelsWithToolSupport();
					
					if (availableModels.length > 0) {
						// Use the same search logic as CLI's interactive mode
						const searchResults = openrouterAPI.searchModels(availableModels, finalModel);
						
						if (searchResults.length > 0) {
							// Find best match using scoring (same as CLI would do)
							const closestModel = findClosestOpenRouterModel(finalModel, availableModels, openrouterAPI);
							
							if (closestModel !== finalModel) {
								const matchedModel = availableModels.find(m => m.id === closestModel);
								logger.agent.info(`  ℹ️  Found closest OpenRouter model: ${chalk.cyan(closestModel)}`);
								if (matchedModel?.name) {
									logger.agent.debug(`     Model name: ${matchedModel.name}`);
								}
								if (searchResults.length > 1) {
									logger.agent.debug(`     (${searchResults.length} matches found, selected best match)`);
								}
								finalModel = closestModel;
							} else {
								// Use first search result if scoring didn't find a better match
								finalModel = searchResults[0].id;
								logger.agent.info(`  ℹ️  Using OpenRouter model: ${chalk.cyan(finalModel)}`);
								if (searchResults.length > 1) {
									logger.agent.debug(`     (${searchResults.length} matches found)`);
								}
							}
						} else {
							logger.agent.warn(`  ⚠️  No OpenRouter models found matching "${finalModel}"`);
							logger.agent.debug(`     Using model as-is: ${finalModel}`);
						}
					}
				} catch (error) {
					logger.agent.warn(`  ⚠️  Could not fetch OpenRouter models for matching: ${error instanceof Error ? error.message : String(error)}`);
					logger.agent.debug(`  Continuing with model: ${finalModel}`);
				}
			}

			// If still no agent determined, default to openrouter
			if (!finalAgentName) {
				logger.agent.warn(`  ⚠️  Could not determine agent, defaulting to openrouter`);
				finalAgentName = 'openrouter';
			}
		} catch (error) {
			logger.agent.error(chalk.yellow(`  ⚠️  Failed to auto-detect from template: ${error instanceof Error ? error.message : String(error)}`));
			logger.agent.debug(`  Continuing with provided or default values...`);
			// Continue with provided values or defaults
			if (!finalAgentName) {
				finalAgentName = 'openrouter';
			}
		}
	}

	// Ensure we have an agent name (default to echo if nothing specified)
	if (!finalAgentName) {
		finalAgentName = 'echo';
	}

	// Create base adapter
	let baseAdapter: AgentAdapter;

	try {
		switch (finalAgentName) {
			case 'openrouter':
				logger.agent.debug(`  Creating OpenRouterAdapter...`);
				// Pass model directly to constructor instead of using environment variable
				baseAdapter = new OpenRouterAdapter(process.env.OPENROUTER_API_KEY, finalModel);
				logger.agent.debug(`  ✓ OpenRouterAdapter created`);
				break;
			case 'anthropic':
				logger.agent.debug(`  Creating AnthropicAdapter...`);
				if (finalModel) {
					process.env.CLAUDE_MODEL = finalModel;
				}
				baseAdapter = new AnthropicAdapter();
				logger.agent.debug(`  ✓ AnthropicAdapter created`);
				break;
			case 'claude-code':
				logger.agent.debug(`  Creating ClaudeCodeAdapter...`);
				baseAdapter = new ClaudeCodeAdapter(finalModel);
				logger.agent.debug(`  ✓ ClaudeCodeAdapter created`);
				break;
			case 'echo':
			default:
				logger.agent.debug(`  Creating EchoAgent...`);
				baseAdapter = new EchoAgent();
				logger.agent.debug(`  ✓ EchoAgent created`);
				break;
		}
	} catch (error) {
		logger.agent.error(chalk.red(`[DEBUG] Failed to create base adapter: ${error instanceof Error ? error.message : String(error)}`));
		throw error;
	}

	// Wrap with SpecialistAdapter if specialist name provided
	if (specialistName && workspaceRoot) {
		try {
			logger.agent.debug(`  Resolving specialist template path...`);
			const templatePath = resolveSpecialistTemplatePath(specialistName, workspaceRoot);
			logger.agent.info(`  ℹ️  Using specialist: ${chalk.cyan(specialistName)}`);
			logger.agent.debug(`     Template: ${templatePath}`);

			// Lazy load SpecialistAdapter to avoid loading agency-prompt-creator unless needed
			logger.agent.debug(`  Loading SpecialistAdapter...`);
			const { SpecialistAdapter } = await import('../../../agent-adapters/src/specialist.ts');
			// Use static factory method for async template loading with inheritance support
			const specialistAdapter = await SpecialistAdapter.create(baseAdapter, templatePath);
			logger.agent.debug(`  ✓ SpecialistAdapter created and wrapped base adapter`);
			return specialistAdapter;
		} catch (error) {
			logger.agent.error(chalk.red(`[DEBUG] Failed to create specialist adapter: ${error instanceof Error ? error.message : String(error)}`));
			throw error;
		}
	}

	logger.agent.debug(`  ✓ Agent adapter creation complete (base adapter only)`);
	return baseAdapter;
}
