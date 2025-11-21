import chalk from 'chalk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ToolDefinition, ToolHandler } from './workspace-tools.ts';
import { z } from 'zod';
import { createFigmaResponseSummary } from './figma-tools.js';

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
	name: string;
	command?: string; // For stdio transport (e.g., "npx")
	args?: string[]; // Command arguments (e.g., ["-y", "@modelcontextprotocol/server-filesystem"])
	env?: Record<string, string>; // Environment variables
	url?: string; // For HTTP transport
	transport?: 'stdio' | 'http' | 'sse';
	required?: boolean;
	allowedTools?: string[];
}

/**
 * MCP Client wrapper with lifecycle management
 */
class MCPClientWrapper {
	private client: Client | null = null;
	private transport: StdioClientTransport | null = null;
	private initialized = false;

	constructor(private config: MCPServerConfig) {}

	getConfig(): MCPServerConfig {
		return this.config;
	}

	async connect(): Promise<void> {
		if (this.client) {
			return; // Already connected
		}

		try {
			if (this.config.transport === 'http' || this.config.url) {
				throw new Error('HTTP/SSE transport not yet implemented');
			}

			// Use stdio transport (most common for MCP servers)
			if (!this.config.command) {
				throw new Error(`MCP server "${this.config.name}" requires a command for stdio transport`);
			}

			const args = this.config.args || [];

			console.log(chalk.blue(`[MCP] Starting MCP server: ${this.config.name}`));
			console.log(chalk.gray(`[MCP] Command: ${this.config.command} ${args.join(' ')}`));

			// Create stdio transport (it handles process spawning internally)
			this.transport = new StdioClientTransport({
				command: this.config.command,
				args: args,
				env: {
					...process.env,
					...(this.config.env || {})
				} as Record<string, string>,
			});

			// Create client
			this.client = new Client(
				{
					name: 'ze-benchmarks',
					version: '0.1.0',
				},
				{
					capabilities: {},
				}
			);

			// Connect (client.connect() calls transport.start() and initializes automatically)
			await this.client.connect(this.transport);
			this.initialized = true;

			console.log(chalk.green(`[MCP] ✓ Connected to ${this.config.name}`));
		} catch (error) {
			console.error(chalk.red(`[MCP] ✗ Failed to connect to ${this.config.name}: ${error instanceof Error ? error.message : String(error)}`));
			await this.disconnect();
			throw error;
		}
	}

	async getTools(): Promise<any[]> {
		if (!this.client || !this.initialized) {
			throw new Error(`MCP client for ${this.config.name} not initialized`);
		}

		try {
			// Create a permissive Zod schema that accepts any tool format
			const ListToolsResultSchema = z.object({
				tools: z.array(z.any())
			});

			// Use request with proper Zod schema
			const response = await (this.client as any).request(
				{ method: 'tools/list' },
				ListToolsResultSchema
			);

			// Extract tools from response
			const tools = response.tools || [];
			console.log(chalk.green(`[MCP] Found ${tools.length} tools from ${this.config.name}`));

			// Log tool names for debugging
			tools.forEach((tool: any) => {
				console.log(chalk.blue(`[MCP]   - ${tool.name} (from ${this.config.name})`));
			});

			return tools;
		} catch (error) {
			console.error(chalk.red(`[MCP] Failed to list tools from ${this.config.name}`));
			console.error(chalk.red(`[MCP] Error: ${error instanceof Error ? error.message : String(error)}`));
			return [];
		}
	}

	async callTool(name: string, args: any): Promise<any> {
		if (!this.client || !this.initialized) {
			throw new Error(`MCP client for ${this.config.name} not initialized`);
		}

		return await this.client.callTool({
			name,
			arguments: args,
		});
	}

	async disconnect(): Promise<void> {
		if (this.client) {
			try {
				await this.client.close();
			} catch (error) {
				console.error(chalk.yellow(`[MCP] Error closing client for ${this.config.name}: ${error instanceof Error ? error.message : String(error)}`));
			}
			this.client = null;
		}

		if (this.transport) {
			try {
				await this.transport.close();
			} catch (error) {
				console.error(chalk.yellow(`[MCP] Error closing transport for ${this.config.name}: ${error instanceof Error ? error.message : String(error)}`));
			}
			this.transport = null;
		}

		// Note: process is managed by transport, no need to kill separately
		this.initialized = false;
	}

	isConnected(): boolean {
		return this.initialized && this.client !== null;
	}
}

/**
 * Convert MCP tool to ToolDefinition format
 */
function convertMCPToolToDefinition(mcpTool: any): ToolDefinition {
	return {
		name: mcpTool.name,
		description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
		input_schema: mcpTool.inputSchema || {
			type: 'object',
			properties: {},
		},
	};
}

/**
 * Create tool handler for an MCP tool
 */
function createMCPToolHandler(
	clientWrapper: MCPClientWrapper,
	toolName: string
): ToolHandler {
	return async (input: any): Promise<string> => {
		try {
			const result = await clientWrapper.callTool(toolName, input);

			// Handle MCP tool result format
			if (result.isError) {
				const errorMessage = result.content
					?.map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
					.join('\n') || 'Unknown error';
				return `Error: ${errorMessage}`;
			}

			// Convert MCP result content to string
			let contentString = '';
			if (result.content && result.content.length > 0) {
				contentString = result.content
					.map((c: any) => {
						if (c.type === 'text') {
							return c.text;
						}
						return JSON.stringify(c, null, 2);
					})
					.join('\n');
			} else {
				return 'Tool executed successfully (no output)';
			}

			// Always create summaries for Figma file responses to reduce token usage and prevent API errors
			// OpenRouter and most APIs have limits on message size
			const MAX_RESPONSE_SIZE = 500000; // ~500KB to leave room for conversation context
			
			// For figma_get_file, always create a summary (even if response is small)
			if (toolName === 'figma_get_file') {
				try {
					const jsonData = JSON.parse(contentString);
					if (jsonData.document) {
						console.log(chalk.blue(`[MCP] Creating summary for figma_get_file response (${contentString.length} chars, ${(contentString.length / 1024).toFixed(2)} KB)`));
						const summary = createFigmaResponseSummary(jsonData);
						console.log(chalk.green(`[MCP] ✓ Created summary (${summary.length} chars, ${(summary.length / 1024).toFixed(2)} KB)`));
						return summary;
					}
				} catch (e) {
					console.log(chalk.yellow(`[MCP] ⚠️  Could not parse figma_get_file response as JSON, returning as-is`));
				}
			}
			
			// For other large responses, check size and summarize/truncate if needed
			if (contentString.length > MAX_RESPONSE_SIZE) {
				console.log(chalk.yellow(`[MCP] ⚠️  Tool ${toolName} returned very large response (${contentString.length} chars, ${(contentString.length / 1024).toFixed(2)} KB)`));
				console.log(chalk.yellow(`[MCP] ⚠️  Truncating to prevent API errors...`));
				
				// Try to parse as JSON and create a summary if possible
				try {
					const jsonData = JSON.parse(contentString);
					
					// For other Figma-related tools, try to create a summary
					if (toolName.startsWith('figma_') && jsonData) {
						// Create a simple summary structure
						const summary = {
							_summary: true,
							_originalSize: contentString.length,
							_data: Object.keys(jsonData).reduce((acc: any, key: string) => {
								const value = jsonData[key];
								if (Array.isArray(value)) {
									acc[key] = {
										_count: value.length,
										_samples: value.slice(0, 10)
									};
								} else if (typeof value === 'object' && value !== null) {
									acc[key] = {
										_keys: Object.keys(value).slice(0, 20),
										_count: Object.keys(value).length
									};
								} else {
									acc[key] = value;
								}
								return acc;
							}, {}),
							_note: `Response summarized: original size was ${contentString.length} characters. Showing summary structure.`
						};
						const summaryString = JSON.stringify(summary, null, 2);
						console.log(chalk.green(`[MCP] ✓ Created summary (${summaryString.length} chars, ${(summaryString.length / 1024).toFixed(2)} KB)`));
						return summaryString;
					}
					
					// For other large JSON responses, truncate and add note
					const truncated = contentString.substring(0, MAX_RESPONSE_SIZE - 500);
					return truncated + `\n\n... [Response truncated: original size was ${contentString.length} characters. Showing first ${MAX_RESPONSE_SIZE - 500} characters.]`;
				} catch (e) {
					// Not JSON, just truncate
					const truncated = contentString.substring(0, MAX_RESPONSE_SIZE - 200);
					return truncated + `\n\n... [Response truncated: original size was ${contentString.length} characters. Showing first ${MAX_RESPONSE_SIZE - 200} characters.]`;
				}
			}

			return contentString;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(chalk.red(`[MCP] Tool ${toolName} error: ${errorMessage}`));
			return `Error calling MCP tool ${toolName}: ${errorMessage}`;
		}
	};
}

/**
 * Resolve MCP server configuration from template MCP definition
 * 
 * This function maps MCP definitions from specialist templates to actual
 * MCP server configurations. For now, we support a simple mapping where
 * common MCP server names map to known commands.
 */
export function resolveMCPConfig(mcpDef: {
	name: string;
	version?: string;
	permissions?: string[];
	description?: string;
	required?: boolean;
	allowed_tools?: string[];
}): MCPServerConfig {
	const name = mcpDef.name.toLowerCase();

	// Map common MCP server names to their commands
	// This is a simple mapping - in production, you might want a registry or config file
	const mcpServerMap: Record<string, { command: string; args: string[]; env?: Record<string, string> }> = {
		'filesystem': {
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
		},
		'filesystem-mcp': {
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
		},
		'@modelcontextprotocol/server-filesystem': {
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
		},
		'github': {
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-github'],
		},
		'@modelcontextprotocol/server-github': {
			command: 'npx',
			args: ['-y', '@modelcontextprotocol/server-github'],
		},
		'figma': {
			command: 'npx',
			args: ['-y', '@thirdstrandstudio/mcp-figma'],
			env: {
				FIGMA_API_KEY: process.env.FIGMA_API_KEY || '',
			},
		},
		'@thirdstrandstudio/mcp-figma': {
			command: 'npx',
			args: ['-y', '@thirdstrandstudio/mcp-figma'],
			env: {
				FIGMA_API_KEY: process.env.FIGMA_API_KEY || '',
			},
		},
	};

	const serverConfig = mcpServerMap[name];

	if (!serverConfig) {
		// If not found in map, try to use the name as a command directly
		// This allows custom MCP servers to be specified by their package name
		return {
			name: mcpDef.name,
			command: 'npx',
			args: ['-y', mcpDef.name],
			transport: 'stdio',
			required: mcpDef.required ?? false,
		allowedTools: mcpDef.allowed_tools,
		};
	}

	return {
		name: mcpDef.name,
		command: serverConfig.command,
		args: serverConfig.args,
		env: serverConfig.env,
		transport: 'stdio',
		required: mcpDef.required ?? false,
		allowedTools: mcpDef.allowed_tools,
	};
}

/**
 * Initialize MCP clients from configuration
 */
export async function initializeMCPClients(
	configs: MCPServerConfig[],
	quiet: boolean = false
): Promise<Map<string, MCPClientWrapper>> {
	const clients = new Map<string, MCPClientWrapper>();

	for (const config of configs) {
		try {
			const wrapper = new MCPClientWrapper(config);
			await wrapper.connect();
			clients.set(config.name, wrapper);

			if (!quiet) {
				console.log(chalk.green(`[MCP] ✓ Initialized ${config.name}`));
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (config.required) {
				throw new Error(`Required MCP server "${config.name}" failed to initialize: ${errorMessage}`);
			} else {
				console.warn(chalk.yellow(`[MCP] ⚠️  Optional MCP server "${config.name}" failed to initialize: ${errorMessage}`));
			}
		}
	}

	return clients;
}

/**
 * Load tools from MCP clients and convert to ToolDefinition format
 */
export async function loadMCPTools(
	clients: Map<string, MCPClientWrapper>,
	quiet: boolean = false
): Promise<{ tools: ToolDefinition[]; handlers: Map<string, ToolHandler> }> {
	const tools: ToolDefinition[] = [];
	const handlers = new Map<string, ToolHandler>();

	for (const [serverName, clientWrapper] of clients.entries()) {
		try {
			const config = clientWrapper.getConfig();
			const allowedToolsSet =
				config.allowedTools && config.allowedTools.length > 0
					? new Set(config.allowedTools)
					: null;

			const mcpTools = await clientWrapper.getTools();

			if (!quiet) {
				console.log(chalk.blue(`[MCP] Found ${mcpTools.length} tools from ${serverName}`));
			}

			for (const mcpTool of mcpTools) {
				if (allowedToolsSet && !allowedToolsSet.has(mcpTool.name)) {
					if (!quiet) {
						console.log(
							chalk.gray(
								`[MCP]   - Skipping ${mcpTool.name} (not in allowed list for ${serverName})`,
							),
						);
					}
					continue;
				}
				const toolDef = convertMCPToolToDefinition(mcpTool);
				tools.push(toolDef);

				// Create handler with server name prefix to avoid conflicts
				const handlerName = `${serverName}_${mcpTool.name}`;
				const handler = createMCPToolHandler(clientWrapper, mcpTool.name);
				handlers.set(handlerName, handler);

				// Also register without prefix for convenience (last one wins if conflicts)
				handlers.set(mcpTool.name, handler);

				if (!quiet) {
					console.log(chalk.gray(`[MCP]   - ${mcpTool.name} (from ${serverName})`));
				}
			}
		} catch (error) {
			console.error(chalk.red(`[MCP] Failed to load tools from ${serverName}: ${error instanceof Error ? error.message : String(error)}`));
		}
	}

	return { tools, handlers };
}

/**
 * Cleanup MCP clients
 */
export async function cleanupMCPClients(clients: Map<string, MCPClientWrapper>): Promise<void> {
	for (const [name, client] of clients.entries()) {
		try {
			await client.disconnect();
			console.log(chalk.gray(`[MCP] Disconnected from ${name}`));
		} catch (error) {
			console.error(chalk.yellow(`[MCP] Error disconnecting from ${name}: ${error instanceof Error ? error.message : String(error)}`));
		}
	}
}

