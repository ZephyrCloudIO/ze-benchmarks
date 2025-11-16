import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { EchoAgent, ClaudeCodeAdapter, OpenRouterAdapter, AnthropicAdapter, type AgentAdapter } from '../../../agent-adapters/src/index.ts';

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

	// Construct template path relative to workspace root
	const templatePath = `starting_from_outcome/${templateName}-template.json5`;
	const absolutePath = resolve(workspaceRoot, templatePath);

	// Verify template exists
	if (!existsSync(absolutePath)) {
		throw new Error(
			`Specialist template not found: ${templatePath}\n` +
			`  Specialist: ${specialistName}\n` +
			`  Expected path: ${absolutePath}\n` +
			`  Tip: Ensure the template file exists in starting_from_outcome/`
		);
	}

	// Return absolute path to avoid cwd-related issues when harness is spawned
	// from different directories (similar to mint:snapshot fix)
	return absolutePath;
}

export async function createAgentAdapter(agentName: string, model?: string, specialistName?: string, workspaceRoot?: string): Promise<AgentAdapter> {
	// Log agent creation attempt
	console.log(chalk.gray('[DEBUG] createAgentAdapter()'));
	console.log(chalk.gray(`  Agent: ${agentName}`));
	console.log(chalk.gray(`  Model: ${model || 'default'}`));
	console.log(chalk.gray(`  Specialist: ${specialistName || 'none'}`));
	console.log(chalk.gray(`  Workspace root: ${workspaceRoot || 'none'}`));

	// Create base adapter
	let baseAdapter: AgentAdapter;

	try {
		switch (agentName) {
			case 'openrouter':
				console.log(chalk.gray(`  Creating OpenRouterAdapter...`));
				// Pass model directly to constructor instead of using environment variable
				baseAdapter = new OpenRouterAdapter(process.env.OPENROUTER_API_KEY, model);
				console.log(chalk.gray(`  ✓ OpenRouterAdapter created`));
				break;
			case 'anthropic':
				console.log(chalk.gray(`  Creating AnthropicAdapter...`));
				if (model) {
					process.env.CLAUDE_MODEL = model;
				}
				baseAdapter = new AnthropicAdapter();
				console.log(chalk.gray(`  ✓ AnthropicAdapter created`));
				break;
			case 'claude-code':
				console.log(chalk.gray(`  Creating ClaudeCodeAdapter...`));
				baseAdapter = new ClaudeCodeAdapter(model);
				console.log(chalk.gray(`  ✓ ClaudeCodeAdapter created`));
				break;
			case 'echo':
			default:
				console.log(chalk.gray(`  Creating EchoAgent...`));
				baseAdapter = new EchoAgent();
				console.log(chalk.gray(`  ✓ EchoAgent created`));
				break;
		}
	} catch (error) {
		console.error(chalk.red(`[DEBUG] Failed to create base adapter: ${error instanceof Error ? error.message : String(error)}`));
		throw error;
	}

	// Wrap with SpecialistAdapter if specialist name provided
	if (specialistName && workspaceRoot) {
		try {
			console.log(chalk.gray(`  Resolving specialist template path...`));
			const templatePath = resolveSpecialistTemplatePath(specialistName, workspaceRoot);
			console.log(chalk.blue(`  ℹ️  Using specialist: ${chalk.cyan(specialistName)}`));
			console.log(chalk.gray(`     Template: ${templatePath}`));

			// Lazy load SpecialistAdapter to avoid loading agency-prompt-creator unless needed
			console.log(chalk.gray(`  Loading SpecialistAdapter...`));
			const { SpecialistAdapter } = await import('../../../agent-adapters/src/specialist.ts');
			const specialistAdapter = new SpecialistAdapter(baseAdapter, templatePath);
			console.log(chalk.gray(`  ✓ SpecialistAdapter created and wrapped base adapter`));
			return specialistAdapter;
		} catch (error) {
			console.error(chalk.red(`[DEBUG] Failed to create specialist adapter: ${error instanceof Error ? error.message : String(error)}`));
			throw error;
		}
	}

	console.log(chalk.gray(`  ✓ Agent adapter creation complete (base adapter only)`));
	return baseAdapter;
}
