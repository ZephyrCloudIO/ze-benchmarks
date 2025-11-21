import { existsSync, readdirSync, mkdirSync, rmSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import type { AgentRequest } from '../../../agent-adapters/src/index.ts';
import { getScenarioDir } from './scenario.ts';
import { logger } from '@ze/logger';

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
		logger.warmup.info(chalk.blue('🔥 Executing warmup phase...'));
		logger.warmup.info(`Working directory: ${workingDir}`);
		logger.warmup.info(`Expected control folder: ${join(workingDir, 'control')}`);
	}

	// Create working directory if it doesn't exist, or clean it if it does
	if (existsSync(workingDir)) {
		// Clean existing directory
		try {
			const files = readdirSync(workingDir);
			if (!quiet) {
				logger.warmup.info(`Cleaning existing working directory...`);
				logger.warmup.info(`Removing: [${files.join(', ')}]`);
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
			logger.warmup.success(`Created working directory: ${workingDir}`);
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
			logger.warmup.info(`Provider: ${provider}`);
			logger.warmup.info(`Model: ${model || 'default'}`);
		}

		try {
			// Create agent adapter
			const agentAdapter = await createAgentAdapter(provider, model);

			// Auto-inject control folder instruction
			const controlInstruction = `\n\nIMPORTANT: When your task is complete, you MUST create a folder named 'control' in the workspace root. This folder is used by the harness to validate warmup completion.`;

			// Build the request
			const messages: Array<{ role: 'system' | 'user'; content: string }> = [
				{
					role: 'user' as const,
					content: prompt + controlInstruction
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
				logger.warmup.info(`Starting agent execution...`);
				logger.warmup.info(`Agent: ${agentAdapter.constructor.name}`);
				logger.warmup.info(`Workspace: ${request.workspaceDir}`);
			}

			const response = await agentAdapter.send(request);

			if (!quiet) {
				logger.warmup.success(`✓ Agent execution completed`);
				logger.warmup.info(`Tool calls made: ${response.toolCalls || 0}`);
				logger.warmup.info(`Tokens used: ${response.tokensIn} in / ${response.tokensOut} out`);

				if (response.content) {
					const preview = response.content.substring(0, 150).replace(/\n/g, ' ');
					logger.warmup.debug(`Final response: ${preview}${response.content.length > 150 ? '...' : ''}`);
				}

				// Warn if no tools were called
				if (!response.toolCalls || response.toolCalls === 0) {
					logger.warmup.warn(`⚠️  Warning: Agent did not use any tools`);
					logger.warmup.warn(`Agent may not have understood the task requires tool use`);
				}
			}

			// Validate control folder was created
			const controlPath = join(workingDir, 'control');
			if (!quiet) {
				logger.warmup.info(`Validating control folder at: ${controlPath}`);
			}

			if (!existsSync(controlPath)) {
				logger.warmup.error(`❌ Control folder not found`);
				logger.warmup.error(`Expected at: ${controlPath}`);
				return {
					success: false,
					error: `Control folder not created at ${controlPath}`,
					controlPath
				};
			}

			const controlContents = readdirSync(controlPath);
			if (!quiet) {
				logger.warmup.success(`✓ Control folder created successfully`);
				logger.warmup.info(`Contents: [${controlContents.join(', ')}]`);
			}

			if (controlContents.length === 0) {
				logger.warmup.warn(`⚠ Warning: Control folder is empty`);
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
			logger.warmup.error(`❌ Exception during agent execution`);
			logger.warmup.error(`${err.message}`);
			if (err.stack) {
				logger.warmup.debug(err.stack);
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

		if (!quiet) logger.warmup.info(`   Running ${commands.length} warmup commands...`);

		for (const cmdCfg of commands) {
			const cmd = cmdCfg.cmd;
			const description = cmdCfg.description || cmd;

			if (!quiet) logger.warmup.debug(`   → ${description}`);

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

		if (!quiet) logger.warmup.success('   ✓ Warmup commands completed');
		return { success: true };
	} else {
		return { success: false, error: `Unknown warmup type: ${warmupCfg.type}` };
	}
}
