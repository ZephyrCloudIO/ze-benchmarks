import { existsSync, readdirSync, mkdirSync, rmSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import type { AgentRequest } from '../../agent-adapters/src/index.ts';
import { getScenarioDir } from './scenario.ts';

// ============================================================================
// WARMUP EXECUTION
// ============================================================================

export async function executeWarmup(
	suite: string,
	scenario: string,
	scenarioCfg: any,
	createAgentAdapter: (agentName: string, model?: string, specialistName?: string) => Promise<any>,
	quiet: boolean = false
): Promise<{ success: boolean; error?: string }> {
	// Check if warmup is enabled
	if (!scenarioCfg.warmup || !scenarioCfg.warmup.enabled) {
		return { success: true }; // No warmup configured, continue normally
	}

	const warmupCfg = scenarioCfg.warmup;
	const scenarioDir = getScenarioDir(suite, scenario);
	const workingDir = join(scenarioDir, warmupCfg.working_dir || './repo-fixture');

	if (!quiet) {
		console.log(chalk.blue('🔥 Executing warmup phase...'));
		console.log(chalk.gray(`   Working directory: ${workingDir}`));
	}

	// Create working directory if it doesn't exist, or clean it if it does
	if (existsSync(workingDir)) {
		// Clean existing directory
		try {
			const files = readdirSync(workingDir);
			for (const file of files) {
				const filePath = join(workingDir, file);
				const stat = statSync(filePath);
				if (stat.isDirectory()) {
					rmSync(filePath, { recursive: true, force: true });
				} else {
					unlinkSync(filePath);
				}
			}
		} catch (err) {
			return { success: false, error: `Failed to clean warmup directory: ${err}` };
		}
	} else {
		mkdirSync(workingDir, { recursive: true });
	}

	// Execute based on warmup type
	if (warmupCfg.type === 'agent') {
		// Agent-driven warmup
		const agentCfg = warmupCfg.agent;
		const provider = agentCfg.provider || 'openrouter';
		const model = agentCfg.model;
		const prompt = agentCfg.prompt;

		if (!prompt) {
			return { success: false, error: 'Warmup agent prompt is required' };
		}

		if (!quiet) {
			console.log(chalk.gray(`   Provider: ${provider}`));
			console.log(chalk.gray(`   Model: ${model || 'default'}`));
		}

		try {
			// Create agent adapter
			const agentAdapter = await createAgentAdapter(provider, model);

			// Build the request
			const messages: Array<{ role: 'system' | 'user'; content: string }> = [
				{
					role: 'user' as const,
					content: prompt
				}
			];

			const request: AgentRequest = {
				messages,
				workspaceDir: workingDir,
			};

			// Add tools if agent supports them
			if (provider === 'anthropic' || provider === 'openrouter') {
				const { createWorkspaceToolHandlers, getAllWorkspaceTools } = await import('../runtime/workspace-tools.ts');
				const workspaceHandlers = createWorkspaceToolHandlers(workingDir);
				const tools = getAllWorkspaceTools();

				request.tools = tools;
				request.toolHandlers = workspaceHandlers;
			}

			// Execute the agent
			if (!quiet) console.log(chalk.blue('   🤖 Running warmup agent...'));

			const response = await agentAdapter.send(request);

			if (!quiet) {
				console.log(chalk.green('   ✓ Warmup completed successfully'));
				if (response.content) {
					console.log(chalk.gray(`   Agent response: ${response.content.substring(0, 100)}...`));
				}
			}

			return { success: true };
		} catch (err: any) {
			return { success: false, error: `Warmup agent execution failed: ${err.message || err}` };
		}
	} else if (warmupCfg.type === 'scripted') {
		// Scripted warmup
		const commands = warmupCfg.commands || [];

		if (!quiet) console.log(chalk.blue(`   Running ${commands.length} warmup commands...`));

		for (const cmdCfg of commands) {
			const cmd = cmdCfg.cmd;
			const description = cmdCfg.description || cmd;

			if (!quiet) console.log(chalk.gray(`   → ${description}`));

			try {
				const { execSync } = await import('child_process');
				execSync(cmd, {
					cwd: workingDir,
					stdio: quiet ? 'ignore' : 'inherit',
					encoding: 'utf8'
				});
			} catch (err: any) {
				return { success: false, error: `Warmup command failed: ${cmd}\n${err.message || err}` };
			}
		}

		if (!quiet) console.log(chalk.green('   ✓ Warmup commands completed'));
		return { success: true };
	} else {
		return { success: false, error: `Unknown warmup type: ${warmupCfg.type}` };
	}
}
