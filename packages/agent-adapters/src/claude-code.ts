import { spawn } from 'node:child_process';
import type { AgentAdapter, AgentRequest, AgentResponse } from './index.js';

type ParsedClaudeResponse = {
	content: string;
	tokensIn?: number;
	tokensOut?: number;
	costUsd?: number;
	toolCalls?: number;
};

export class ClaudeCodeAdapter implements AgentAdapter {
	name = 'claude-code';
	private model?: string;
	private defaultMaxTurns: number;
	private permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

	constructor(model?: string, defaultMaxTurns = 10, permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' = 'bypassPermissions') {
		this.model = model;
		this.defaultMaxTurns = defaultMaxTurns;
		this.permissionMode = permissionMode;
	}

	async send(request: AgentRequest): Promise<AgentResponse> {
		// Convert messages to a single prompt string
		const prompt = this.convertMessagesToPrompt(request.messages);

		try {
			const maxTurns = Math.max(1, request.maxTurns ?? this.defaultMaxTurns);
			const args = [
				'-p',
				'--output-format', 'json',
				'--max-turns', String(maxTurns),
				'--verbose',
			];

			if (this.permissionMode) {
				args.push('--permission-mode', this.permissionMode);
			}

			if (this.model) {
				args.push('--model', this.model);
			}

			if (request.workspaceDir) {
				args.push('--add-dir', request.workspaceDir);
			}

			console.log('Executing Claude with args:', args);
			console.log('Input prompt:', prompt);
			console.log('Workspace directory:', request.workspaceDir || 'current directory');

			const response = await this.executeClaudeCommand(args, prompt, request.workspaceDir);

			return {
				content: response.content,
				tokensIn: response.tokensIn,
				tokensOut: response.tokensOut,
				costUsd: response.costUsd,
				toolCalls: response.toolCalls,
			};
		} catch (error) {
			throw new Error(`Claude Code CLI error: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private executeClaudeCommand(args: string[], input: string, workspaceDir?: string): Promise<ParsedClaudeResponse> {
		return new Promise((resolve, reject) => {
			const options: any = {
				stdio: ['pipe', 'pipe', 'pipe'],
			};

			// Set working directory if provided
			if (workspaceDir) {
				options.cwd = workspaceDir;
			}

			const child = spawn('claude', args, options);

			let stdout = '';
			let stderr = '';

			child.stdout.on('data', (data) => {
				stdout += data.toString();
			});

			child.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			child.on('close', (code) => {
				if (code !== 0) {
					reject(new Error(`Claude CLI exited with code ${code}. stderr: ${stderr}`));
					return;
				}

				if (stderr) {
					console.warn('Claude CLI stderr:', stderr);
				}

				// Debug: Log raw output
				console.log('Raw Claude output:', stdout);

				try {
					const response = this.parseClaudeOutput(stdout);
					resolve(response);
				} catch (parseError) {
					reject(new Error(`Failed to parse Claude output: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
				}
			});

			child.on('error', (error) => {
				reject(new Error(`Failed to start Claude CLI: ${error.message}`));
			});

			// Send input and close stdin
			child.stdin.write(input);
			child.stdin.end();
		});
	}

	private convertMessagesToPrompt(messages: AgentRequest['messages']): string {
		// Convert conversation messages to a single prompt
		const parts: string[] = [];

		for (const message of messages) {
			if (message.role === 'system') {
				parts.push(`System Instructions: ${message.content}`);
			} else if (message.role === 'user') {
				parts.push(`${message.content}`);
			} else if (message.role === 'assistant') {
				parts.push(`Previous Response: ${message.content}`);
			}
		}

		return parts.join('\n\n');
	}

	private parseClaudeOutput(output: string): ParsedClaudeResponse {
		const trimmed = output.trim();
		if (!trimmed) {
			return { content: '' };
		}

		try {
			const parsed = JSON.parse(trimmed);

			if (Array.isArray(parsed)) {
				let content = '';
				let tokensIn = 0;
				let tokensOut = 0;
				let costUsd: number | undefined;
				let reportedToolCalls: number | undefined;
				let observedToolCalls = 0;
				const assistantMessages: string[] = [];

				for (const entry of parsed) {
					if (!entry || typeof entry !== 'object') {
						continue;
					}

					if (entry.type === 'assistant' && entry.message?.content) {
						const contents = Array.isArray(entry.message.content)
							? entry.message.content
							: [entry.message.content];

						for (const item of contents) {
							if (!item) {
								continue;
							}
							if (typeof item === 'object') {
								if (item.type === 'text' && typeof item.text === 'string') {
									assistantMessages.push(item.text);
								}
								if (item.type === 'tool_use') {
									observedToolCalls += 1;
								}
							} else if (typeof item === 'string') {
								assistantMessages.push(item);
							}
						}
					}

					if (typeof entry.usage?.input_tokens === 'number') {
						tokensIn += entry.usage.input_tokens;
					}
					if (typeof entry.usage?.output_tokens === 'number') {
						tokensOut += entry.usage.output_tokens;
					}
					if (typeof entry.total_cost_usd === 'number') {
						costUsd = Math.max(costUsd ?? 0, entry.total_cost_usd);
					}
					if (typeof entry.tool_use_count === 'number') {
						reportedToolCalls = Math.max(reportedToolCalls ?? 0, entry.tool_use_count);
					}

					if (entry.type === 'result') {
						if (entry.result && typeof entry.result === 'string') {
							content = entry.result;
						}
						if (typeof entry.usage?.input_tokens === 'number') {
							tokensIn = Math.max(tokensIn, entry.usage.input_tokens);
						}
						if (typeof entry.usage?.output_tokens === 'number') {
							tokensOut = Math.max(tokensOut, entry.usage.output_tokens);
						}
						if (typeof entry.total_cost_usd === 'number') {
							costUsd = Math.max(costUsd ?? 0, entry.total_cost_usd);
						}
						if (typeof entry.tool_use_count === 'number') {
							reportedToolCalls = Math.max(reportedToolCalls ?? 0, entry.tool_use_count);
						}
					}
				}

				if (!content && assistantMessages.length > 0) {
					content = assistantMessages.join('\n\n');
				}

				return {
					content: content || trimmed,
					tokensIn: tokensIn || undefined,
					tokensOut: tokensOut || undefined,
					costUsd,
					toolCalls: reportedToolCalls ?? observedToolCalls,
				};
			}

			if (parsed && typeof parsed === 'object') {
				if (parsed.type === 'result') {
					const content = typeof parsed.result === 'string'
						? parsed.result
						: `Claude execution status: ${parsed.subtype} (${parsed.num_turns || 0} turns)`;
					return {
						content,
						tokensIn: parsed.usage?.input_tokens,
						tokensOut: parsed.usage?.output_tokens,
						costUsd: parsed.total_cost_usd,
						toolCalls: parsed.tool_use_count,
					};
				}

				return { content: trimmed };
			}

			return { content: trimmed };
		} catch (parseError) {
			try {
				const lines = trimmed.split('\n').filter(line => line.trim());
				let content = '';
				let tokensIn = 0;
				let tokensOut = 0;
				let costUsd: number | undefined;
				let reportedToolCalls: number | undefined;
				let observedToolCalls = 0;
				const assistantMessages: string[] = [];

				for (const line of lines) {
					try {
						const parsedLine = JSON.parse(line);

						if (parsedLine.type === 'assistant' && parsedLine.message?.content) {
							const contents = Array.isArray(parsedLine.message.content)
								? parsedLine.message.content
								: [parsedLine.message.content];

							for (const item of contents) {
								if (!item) {
									continue;
								}
								if (typeof item === 'object') {
									if (item.type === 'text' && typeof item.text === 'string') {
										assistantMessages.push(item.text);
									}
									if (item.type === 'tool_use') {
										observedToolCalls += 1;
									}
								} else if (typeof item === 'string') {
									assistantMessages.push(item);
								}
							}
						}

						if (typeof parsedLine.usage?.input_tokens === 'number') {
							tokensIn += parsedLine.usage.input_tokens;
						}
						if (typeof parsedLine.usage?.output_tokens === 'number') {
							tokensOut += parsedLine.usage.output_tokens;
						}
						if (typeof parsedLine.total_cost_usd === 'number') {
							costUsd = Math.max(costUsd ?? 0, parsedLine.total_cost_usd);
						}
						if (typeof parsedLine.tool_use_count === 'number') {
							reportedToolCalls = Math.max(reportedToolCalls ?? 0, parsedLine.tool_use_count);
						}

						if (parsedLine.type === 'result') {
							if (parsedLine.result && typeof parsedLine.result === 'string') {
								content = parsedLine.result;
							} else if (!content && assistantMessages.length > 0) {
								content = assistantMessages.join('\n\n');
							}
							if (typeof parsedLine.usage?.input_tokens === 'number') {
								tokensIn = Math.max(tokensIn, parsedLine.usage.input_tokens);
							}
							if (typeof parsedLine.usage?.output_tokens === 'number') {
								tokensOut = Math.max(tokensOut, parsedLine.usage.output_tokens);
							}
							if (typeof parsedLine.total_cost_usd === 'number') {
								costUsd = Math.max(costUsd ?? 0, parsedLine.total_cost_usd);
							}
							if (typeof parsedLine.tool_use_count === 'number') {
								reportedToolCalls = Math.max(reportedToolCalls ?? 0, parsedLine.tool_use_count);
							}
						}
					} catch (lineParseError) {
						content += line + '\n';
					}
				}

				if (!content && assistantMessages.length > 0) {
					content = assistantMessages.join('\n\n');
				}

				return {
					content: content || trimmed,
					tokensIn: tokensIn || undefined,
					tokensOut: tokensOut || undefined,
					costUsd,
					toolCalls: reportedToolCalls ?? observedToolCalls,
				};
			} catch (error) {
				return { content: trimmed };
			}
		}
	}
}
