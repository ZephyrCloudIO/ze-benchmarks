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
	const templatePath = `starting_from_outcome/${templateName}.json5`;
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
	// Create base adapter
	let baseAdapter: AgentAdapter;

	switch (agentName) {
		case 'openrouter':
			// Pass model directly to constructor instead of using environment variable
			baseAdapter = new OpenRouterAdapter(process.env.OPENROUTER_API_KEY, model);
			break;
		case 'anthropic':
			if (model) {
				process.env.CLAUDE_MODEL = model;
			}
			baseAdapter = new AnthropicAdapter();
			break;
		case 'claude-code':
			baseAdapter = new ClaudeCodeAdapter(model);
			break;
		case 'echo':
		default:
			baseAdapter = new EchoAgent();
			break;
	}

	// Wrap with SpecialistAdapter if specialist name provided
	if (specialistName && workspaceRoot) {
		const templatePath = resolveSpecialistTemplatePath(specialistName, workspaceRoot);
		console.log(chalk.blue(`  ℹ️  Using specialist: ${chalk.cyan(specialistName)}`));
		console.log(chalk.gray(`     Template: ${templatePath}`));

		// Lazy load SpecialistAdapter to avoid loading agency-prompt-creator unless needed
		const { SpecialistAdapter } = await import('../../../agent-adapters/src/specialist.ts');
		return new SpecialistAdapter(baseAdapter, templatePath);
	}

	return baseAdapter;
}
