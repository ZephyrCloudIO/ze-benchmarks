import { existsSync, readdirSync, mkdirSync, rmSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import type { AgentRequest } from '../../../agent-adapters/src/index.ts';
import { getScenarioDir } from './scenario.ts';

// ============================================================================
// WARMUP EXECUTION
// ============================================================================

export interface WarmupResult {
	success: boolean;
	error?: string;
	controlPath?: string;
	controlContents?: string[];
	agentError?: string;
}

export async function executeWarmup(
	suite: string,
	scenario: string,
	scenarioCfg: any,
	createAgentAdapter: (agentName: string, model?: string, specialistName?: string) => Promise<any>,
	quiet: boolean = false
): Promise<WarmupResult> {
	// Check if warmup is enabled
	if (!scenarioCfg.warmup || !scenarioCfg.warmup.enabled) {
		return { success: true }; // No warmup configured, continue normally
	}

	const warmupCfg = scenarioCfg.warmup;
	const scenarioDir = getScenarioDir(suite, scenario);
	const workingDir = join(scenarioDir, warmupCfg.working_dir || './repo-fixture');

	if (!quiet) {
		console.log(chalk.blue('🔥 Executing warmup phase...'));
		console.log(chalk.blue(`[Warmup] Working directory: ${workingDir}`));
		console.log(chalk.blue(`[Warmup] Expected control folder: ${join(workingDir, 'control')}`));
	}

	// Create working directory if it doesn't exist, or clean it if it does
	if (existsSync(workingDir)) {
		// Clean existing directory
		try {
			const files = readdirSync(workingDir);
			if (!quiet) {
				console.log(chalk.blue(`[Warmup] Cleaning existing working directory...`));
				console.log(chalk.blue(`[Warmup] Removing: [${files.join(', ')}]`));
			}
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
		if (!quiet) {
			console.log(chalk.green(`[Warmup] Created working directory: ${workingDir}`));
		}
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
			console.log(chalk.blue(`[Warmup] Provider: ${provider}`));
			console.log(chalk.blue(`[Warmup] Model: ${model || 'default'}`));
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
			if (!quiet) {
				console.log(chalk.blue(`[Warmup] Starting agent execution...`));
				console.log(chalk.blue(`[Warmup] Agent: ${agentAdapter.constructor.name}`));
				console.log(chalk.blue(`[Warmup] Workspace: ${request.workspaceDir}`));
			}

			const response = await agentAdapter.send(request);

			if (!quiet) {
				console.log(chalk.green(`[Warmup] ✓ Agent execution completed`));
				console.log(chalk.blue(`[Warmup] Tool calls made: ${response.toolCalls || 0}`));
				console.log(chalk.blue(`[Warmup] Tokens used: ${response.tokensIn} in / ${response.tokensOut} out`));

				if (response.content) {
					const preview = response.content.substring(0, 150).replace(/\n/g, ' ');
					console.log(chalk.gray(`[Warmup] Final response: ${preview}${response.content.length > 150 ? '...' : ''}`));
				}

				// Warn if no tools were called
				if (!response.toolCalls || response.toolCalls === 0) {
					console.warn(chalk.yellow(`[Warmup] ⚠️  Warning: Agent did not use any tools`));
					console.warn(chalk.yellow(`[Warmup] Agent may not have understood the task requires tool use`));
				}
			}

			// Validate control folder was created
			const controlPath = join(workingDir, 'control');
			if (!quiet) {
				console.log(chalk.blue(`[Warmup] Validating control folder at: ${controlPath}`));
			}

			if (!existsSync(controlPath)) {
				console.error(chalk.red(`[Warmup] ❌ Control folder not found`));
				console.error(chalk.red(`[Warmup] Expected at: ${controlPath}`));
				return {
					success: false,
					error: `Control folder not created at ${controlPath}`,
					controlPath
				};
			}

			const controlContents = readdirSync(controlPath);
			if (!quiet) {
				console.log(chalk.green(`[Warmup] ✓ Control folder created successfully`));
				console.log(chalk.blue(`[Warmup] Contents: [${controlContents.join(', ')}]`));
			}

			if (controlContents.length === 0) {
				console.warn(chalk.yellow(`[Warmup] ⚠ Warning: Control folder is empty`));
				return {
					success: false,
					error: `Control folder created but is empty`,
					controlPath,
					controlContents
				};
			}

			return {
				success: true,
				controlPath,
				controlContents
			};

		} catch (err: any) {
			console.error(chalk.red(`[Warmup] ❌ Exception during agent execution`));
			console.error(chalk.red(`[Warmup] ${err.message}`));
			if (err.stack) {
				console.error(chalk.gray(err.stack));
			}
			return {
				success: false,
				error: `Exception: ${err.message}`,
				agentError: err.message
			};
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
